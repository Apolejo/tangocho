# Oracle server runbook

The app at **https://apolejo.dev/tangocho/**, served by Caddy from my Oracle Always Free VM and deployed by GitHub Actions on every push to `main` (ROADMAP M11). It is the only copy: the GitHub Pages one is gone, so the repo can be private. M12's sync service will run here too.

Every command below was run on the VM when M11 set it up (2026-10-15). The files it installs live in [`ops/`](../ops/); the repo copy is the source of truth.

## The box, and the rules for working on it

- `ubuntu@157.137.236.96` with the key `~/.ssh/ssh-key-2026-03-06.key`. VM.Standard.A1.Flex (4 OCPU, 24 GB), Ubuntu 24.04, region Bogotá. The DNS for `apolejo.dev` is at Porkbun: the apex has an A record to the VM, `www` is a CNAME to the apex, and there is no wildcard. The MX and SPF records belong to Porkbun's email forwarding. The VM has no public IPv6, so there is no AAAA record.
- **It's shared with my Docker game servers** (Palworld, Project Zomboid, Humanitz; `unless-stopped`, UDP ports only, on bridge networks). So:
  - Never reboot the VM or restart Docker without deciding to.
  - Never flush iptables, run `netfilter-persistent save` or `reload`, or install ufw (each one replaces Docker's rules).
  - Add firewall rules one at a time instead of replacing the set.
- SSH is flaky right after a reboot, and bots try it about a thousand times a day. Retry in a loop:

  ```bash
  for i in 1 2 3 4 5; do ssh -i ~/.ssh/ssh-key-2026-03-06.key -o ConnectTimeout=15 ubuntu@157.137.236.96 && break; sleep 5; done
  ```

On disk:

| Path | What |
|---|---|
| `/srv/tangocho/incoming/` | Where CI's rsync lands. Never served. |
| `/srv/tangocho/releases/<sha>/` | One folder per deployed commit, the five most recent kept. Unchanged files are hard links shared between releases. |
| `/srv/tangocho/current` | Symlink to the release Caddy serves. |
| `/usr/local/bin/tangocho-deploy` | The deploy user's forced command ([`ops/tangocho-deploy.sh`](../ops/tangocho-deploy.sh)). |
| `/etc/caddy/Caddyfile` | [`ops/Caddyfile`](../ops/Caddyfile). |
| `/etc/ssh/sshd_config.d/10-tangocho.conf` | [`ops/sshd-10-tangocho.conf`](../ops/sshd-10-tangocho.conf). |
| `/etc/ssh/tangocho/deploy.pub` | CI's public key, with `restrict,command=…`. Root-owned. |
| `/etc/iptables/rules.v4` | [`ops/rules.v4`](../ops/rules.v4), the host firewall at boot. |
| `/etc/apt/apt.conf.d/52tangocho-caddy` | Caddy in unattended upgrades. |
| `~ubuntu/m11-before/` | The state before M11: `iptables-save`, containers and ports, `sshd -T`, the old `rules.v4`. |

## 1. Look before changing anything

Read-only:

```bash
sudo docker ps -a --format '{{.Names}}\t{{.Status}}'
for c in $(sudo docker ps -aq); do sudo docker inspect -f '{{.Name}} {{.HostConfig.RestartPolicy.Name}} {{.HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}}' $c; done
sudo ss -tulpn
sudo iptables -S; sudo iptables -t nat -S; sudo iptables -t raw -S
sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|x11forwarding) '
```

If a container uses `--network host`, the INPUT allowlist below must open its ports too.

## 2. Firewall, both layers

**Oracle's security list** (in the console, the VCN's subnet): TCP 22, 80 and 443 in, plus the game servers' UDP ports. UDP 443 stays closed, so Caddy serves HTTP/1.1 and HTTP/2 only (`protocols h1 h2`).

**The host.** INPUT was ACCEPT with no rules, and rpcbind listens on port 111 on every interface. The allowlist ends in a REJECT. Docker-published ports are DNATed in `nat PREROUTING` and go through FORWARD, so the game servers never pass through INPUT.

Arm an automatic undo first, then append the rules, each one only if it's missing:

```bash
sudo systemd-run --unit=m11-fw-undo --on-active=300 /usr/sbin/iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited
add() { sudo iptables -C INPUT "$@" 2>/dev/null || sudo iptables -A INPUT "$@"; }
add -i lo -j ACCEPT
add -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
add -p icmp -j ACCEPT
add -p udp -m udp --sport 123 -j ACCEPT
add -p tcp -m tcp --dport 22 -j ACCEPT
add -p tcp -m multiport --dports 80,443 -j ACCEPT
add -j REJECT --reject-with icmp-host-prohibited
```

From a **second** terminal, log in again. If that works, stop the undo: `sudo systemctl stop m11-fw-undo.timer`. If it doesn't, wait five minutes and the REJECT goes away by itself.

Persist the rules for the next boot. The old file was an `iptables-save` snapshot with Docker's rules from August, for a bridge that no longer exists. The new one holds only the INPUT allowlist, and Docker builds its own rules when it starts.

```bash
sudo cp -a /etc/iptables/rules.v4 /etc/iptables/rules.v4.bak-2026-10-15
sudo install -m 640 -o root -g root ops/rules.v4 /etc/iptables/rules.v4
sudo iptables-restore --test /etc/iptables/rules.v4
```

Check: `sudo iptables -nvL INPUT` (the REJECT counter grows with scanner traffic). Compare `sudo iptables-save` against `~/m11-before/iptables-v4.txt` to confirm only INPUT changed. The clean boot file hasn't been through a reboot yet; when I next reboot, check `sudo iptables -S` and a game server afterwards.

## 3. SSH

Keys only was already set (`60-cloudimg-settings.conf`). The drop-in turns off root logins and X11, and confines the deploy user. sshd keeps the first value it reads, so the file is named `10-` to come before Ubuntu's `60-`.

```bash
sudo install -m 644 -o root -g root ops/sshd-10-tangocho.conf /etc/ssh/sshd_config.d/10-tangocho.conf
sudo sshd -t
sudo sshd -T -C user=ubuntu,host=x,addr=192.0.2.1 | grep -Ei '^(permitrootlogin|x11forwarding|authorizedkeysfile) '
sudo sshd -T -C user=deploy,host=x,addr=192.0.2.1 | grep -Ei '^(permittty|allowtcpforwarding|authorizedkeysfile) '
sudo systemctl reload ssh
```

Before closing the session, log in again from a second terminal. Leave `MaxAuthTries` at its default: a lower value locks out an ssh-agent that offers several keys.

## 4. Unattended upgrades

These were already on, for Ubuntu's origins, with automatic reboots off. Keep them off, because of the game servers; `/var/run/reboot-required` says when a kernel update is waiting. Caddy is added, because it faces the internet:

```bash
printf '%s\n' '// docs/ORACLE.md' 'Unattended-Upgrade::Allowed-Origins {' '	"cloudsmith/caddy/stable:any-version";' '};' | sudo tee /etc/apt/apt.conf.d/52tangocho-caddy
sudo unattended-upgrade --dry-run --debug 2>&1 | grep -i 'allowed origins'
```

docker.io comes from Ubuntu, so its security updates already install themselves, and they restart dockerd and every game server with it. That was already the case before M11. If it matters while I'm playing, add `docker.io` to `Unattended-Upgrade::Package-Blacklist`.

## 5. Caddy

Install from Caddy's own repository; Ubuntu's package is 2.6, from 2022. The signing key's fingerprint is `6576 0C51 EDEA 2017 CEA2 CA15 155B 6D79 CA56 EA34`.

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install caddy
```

Never `apt upgrade` the whole box by hand while a game is running. Then apply the Caddyfile, and do the same every time `ops/Caddyfile` changes:

```bash
caddy validate --config ops/Caddyfile --adapter caddyfile
sudo install -m 644 -o root -g root ops/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f        # "certificate obtained successfully" for apolejo.dev and www
```

Certificates come from Let's Encrypt and renew themselves. There is no ACME email, because the Caddyfile is in a public repo, and no access log, because the app's privacy note says progress stays on the device. Caddy serves gzip only, like Pages (Safari's zstd support is recent), and every error as a typed page: a 404 with no Content-Type, under `nosniff`, makes Safari offer to download the address as a file.

## 6. The deploy user and the web root

CI deploys as `deploy`. It has no password, and its only key is forced to [`tangocho-deploy`](../ops/tangocho-deploy.sh), which allows exactly two things:

- **`rsync` into `incoming/`**, through `rrsync -wo -munge`: write-only, and symlinks are made harmless. Caddy would follow a symlink out of the web root.
- **`activate <sha>`**:
  1. Takes rrsync's lock on `incoming/`.
  2. Hard-link copies `incoming/` to `releases/.tmp.<sha>/`.
  3. Refuses it unless it holds `index.html`, `sw.js`, the manifest, every file `sw.js` precaches and the Workbox runtime it loads, and nothing but files and folders.
  4. Renames it to `releases/<sha>/`.
  5. Switches `current` in one rename and keeps five releases.

  A release that already exists is switched to directly, which is how rollback works.

A half-uploaded site is never served: the service worker would precache whatever `index.html` names.

```bash
sudo adduser --disabled-password --gecos "Tangocho deploys (CI)" --shell /bin/sh deploy   # sh: sshd runs the forced command through it
sudo gpasswd -d deploy users
sudo install -d -m 755 -o deploy -g deploy /srv/tangocho /srv/tangocho/incoming /srv/tangocho/releases
sudo install -d -m 755 /usr/local/bin                  # it was missing on this VM
sudo install -m 755 -o root -g root ops/tangocho-deploy.sh /usr/local/bin/tangocho-deploy
sudo install -d -m 755 -o root -g root /etc/ssh/tangocho
echo 'restrict,command="/usr/local/bin/tangocho-deploy" <the public key>' | sudo tee /etc/ssh/tangocho/deploy.pub
```

The key pair is ed25519, made with `ssh-keygen -t ed25519 -N "" -C "tangocho-deploy (GitHub Actions)" -f deploy_key`. The private half goes to GitHub only; delete the local copy afterwards. To replace the key, make a new pair, swap the line in `deploy.pub`, and set the secret again.

Check: `ssh deploy@apolejo.dev ls` must answer `allowed: rsync into incoming/, or activate <sha>`.

## 7. GitHub

Repository secrets and variables (Settings → Secrets and variables → Actions). They are not an environment's: a private repo on GitHub Free has no environments, and a repository secret works on every plan.

- Secret `MIRROR_SSH_KEY`: the private deploy key.
- Variable `MIRROR_KNOWN_HOSTS`: `apolejo.dev ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBeL1jNLanx2QgpmvRxxCHI6wt3JSpP6RlB3YnjahqUh`. That line is `/etc/ssh/ssh_host_ed25519_key.pub` read over my own SSH session, and it matched `ssh-keyscan -t ed25519 apolejo.dev`. If the VM is ever rebuilt, set it again; until then, deploys fail rather than trust a different host.

```bash
gh secret set MIRROR_SSH_KEY < deploy_key
gh variable set MIRROR_KNOWN_HOSTS --body "apolejo.dev ssh-ed25519 …"
```

## Deploying

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), on every push to `main`. The `build` job builds once and hands `dist/` over as an artifact (kept one day) to the `mirror` job, in four steps:

1. Downloads that build.
2. `rsync -rcp --delete` into `incoming/`. With `-c`, unchanged files aren't rewritten, so older releases keep their hard links.
3. `activate $GITHUB_SHA`.
4. `node scripts/smoke.ts https://apolejo.dev/tangocho/ dist`. It fails unless `index.html` and `sw.js` are byte-for-byte this build's, with `no-cache`, and the manifest has its type. A hashed asset must be `immutable`, a missing asset must be a 404 that isn't, with an HTML page, and HSTS must be on.

SSH steps retry three times.

By hand (Actions → Deploy → Run workflow, or `gh workflow run deploy.yml --ref <branch>`): the same deploy from any branch. Nothing but the branch's own code stops it, because there is no environment to restrict it to `main`; the repo is private and I'm its only writer. With `-f stop_halfway=true`, the test of a deploy that stops halfway:

1. It uploads only the new `index.html` and `sw.js`, without their assets.
2. `activate` must refuse that release.
3. The page the mirror serves must be the one it served before.

Run it on a commit that isn't live. The next normal deploy repairs `incoming/`.

**Roll back** to any kept release, as `ubuntu` on the VM:

```bash
ls -lt /srv/tangocho/releases                   # newest first; readlink /srv/tangocho/current says which is live
sudo -u deploy env SSH_ORIGINAL_COMMAND="activate <sha>" /usr/local/bin/tangocho-deploy
```

The next push to `main` deploys forward again.

## Checks

```bash
curl -sI http://apolejo.dev/tangocho/                  # 308 to https
curl -sI https://apolejo.dev/                          # 302 to /tangocho/
curl -sI https://apolejo.dev/tangocho                  # 308 to /tangocho/
curl -sI https://www.apolejo.dev/tangocho/?x=1         # 308 to https://apolejo.dev/tangocho/?x=1
curl -sI https://apolejo.dev/tangocho/                 # 200, cache-control: no-cache, strict-transport-security
curl -sI https://apolejo.dev/tangocho/sw.js            # 200, no-cache
curl -sI https://apolejo.dev/tangocho/manifest.webmanifest   # 200, no-cache, application/manifest+json
curl -sI https://apolejo.dev/tangocho/assets/<index-hash>.js # 200, public, max-age=31536000, immutable
curl -sI https://apolejo.dev/tangocho/assets/nope.js   # 404, no-cache: a missing asset is never kept
curl -sI https://apolejo.dev/tanocho                   # 404 with a text/html page linking to the app (an untyped empty 404 made Safari offer a download)
```

## Troubleshooting

- **A deploy can't connect.**
  - Check the security list still opens 22, and look at `sudo journalctl -u ssh --since -1h`.
  - `grep -i maxstartups` in that log means scanners are filling sshd's unauthenticated slots; the deploy's retries usually get through.
  - Right after a reboot, wait a minute.
- **The certificate doesn't renew.** Ports 80 and 443 must reach Caddy at both layers. Check `sudo journalctl -u caddy | grep -i tls`.
- **`activate` refuses a normal deploy.** The message lists the missing files. A Workbox upgrade that changed `sw.js`'s format would show up as "sw.js lists no precached files": update the patterns in `check_release`, and add a test case in `scripts/deploy-server.test.ts`.
- **A game server is unreachable after a change.** Compare `sudo iptables-save` with `~/m11-before/`. Take the REJECT out with `sudo iptables -D INPUT -j REJECT --reject-with icmp-host-prohibited`, then look again.

## For M12

The sync service goes at `https://apolejo.dev/api/`, outside the service worker's scope (`/tangocho/`). The Caddyfile answers 404 there until a `handle /api/*` block proxies to it. It runs under systemd on the host, not in Docker, and listens on localhost only. The host firewall needs no change for it.
