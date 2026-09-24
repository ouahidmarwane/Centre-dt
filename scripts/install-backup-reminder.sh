#!/usr/bin/env bash
# Installs a systemd *user* timer that shows a desktop notification on the 1st of every
# month at 10:00 (or at the next login if the computer was off) reminding the operator
# to run `npm run backup:drill`. The drill itself stays manual: the database password
# and the GPG passphrase are typed by a person and never stored.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$units"
cat > "$units/cabinet-backup-reminder.service" <<UNIT
[Unit]
Description=Rappel : test mensuel de sauvegarde et restauration du cabinet

[Service]
Type=oneshot
ExecStart=/usr/bin/notify-send --urgency=critical --app-name="Centre Dentaire Ouahid" "Test mensuel de sauvegarde" "Lancez : cd $repo && npm run backup:drill (hors heures d'ouverture, disque externe branché)."
UNIT
cat > "$units/cabinet-backup-reminder.timer" <<UNIT
[Unit]
Description=Rappel mensuel du test de sauvegarde et restauration

[Timer]
OnCalendar=*-*-01 10:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now cabinet-backup-reminder.timer
systemctl --user list-timers cabinet-backup-reminder.timer --no-pager
