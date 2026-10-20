#!/bin/sh
# Optional fixed stream; no shell fragments/paths from environment.
set -eu
[ "${PULSE_OBSERVABILITY_ENABLED:-false}" = true ] || exit 0
umask 0027
if ! { ( : >> /var/log/pulse/pulse.jsonl ) &&
       chown nginx:telemetry /var/log/pulse/pulse.jsonl &&
       chmod 0640 /var/log/pulse/pulse.jsonl; } 2>/dev/null; then
  echo '{"event_name":"telemetry.file_disabled","service.name":"pulse-frontend"}' >&2
  exit 0
fi
if ! cp /etc/nginx/o2.conf /etc/nginx/conf.d/default.conf; then
  echo '{"event_name":"telemetry.file_disabled","service.name":"pulse-frontend"}' >&2
  exit 0
fi
# One worker tied to this container/PID1. Docker kills remaining processes when
# PID1 exits; no second watcher, runtime flag hook, or copytruncate.
(
  while sleep 1; do
    [ -r /var/run/nginx.pid ] || continue
    master=$(cat /var/run/nginx.pid)
    case "$master" in *[!0-9]*|'') continue ;; esac
    kill -0 "$master" 2>/dev/null || exit 0
    bytes=$(stat -c %s /var/log/pulse/pulse.jsonl 2>/dev/null) || continue
    [ "$bytes" -ge 2097152 ] || continue
    if rm -f /var/log/pulse/pulse.jsonl.2 &&
       { [ ! -e /var/log/pulse/pulse.jsonl.1 ] || mv /var/log/pulse/pulse.jsonl.1 /var/log/pulse/pulse.jsonl.2; } &&
       mv /var/log/pulse/pulse.jsonl /var/log/pulse/pulse.jsonl.1 &&
       ( : > /var/log/pulse/pulse.jsonl ) &&
       chown nginx:telemetry /var/log/pulse/pulse.jsonl &&
       chmod 0640 /var/log/pulse/pulse.jsonl &&
       kill -USR1 "$master"; then
      :
    else
      # Static safe diagnostic. Overshoot until poll is workload-dependent;
      # 16MiB tmpfs is the hard filesystem bound.
      echo '{"event_name":"telemetry.rotation_failed","service.name":"pulse-frontend"}' >&2
    fi
  done
) &
