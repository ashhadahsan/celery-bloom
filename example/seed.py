"""
Send a burst of example tasks to populate celery-bloom.

Usage:
  python example/seed.py
  python example/seed.py --count 60
"""
import argparse
import random
import time
from celery import chain, group, chord
from tasks import add, slow_job, flaky, process_batch, normalize, notify


def send_chain():
    (add.s(random.randint(1, 50), random.randint(1, 50))
     | normalize.s()
     | notify.s()).delay()


def send_group():
    items = [random.randint(1, 99) for _ in range(random.randint(3, 6))]
    chord(
        group(add.s(x, random.randint(1, 10)) for x in items),
        notify.si({"batch_size": len(items)}),
    ).delay()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=60)
    args = parser.parse_args()

    print(f"Sending {args.count} tasks…")

    # Always send a few long-running tasks first so they show as STARTED
    # in the dashboard while the rest fill in
    print("  [*] Sending long-running tasks (will stay STARTED for screenshots)…")
    for _ in range(4):
        slow_job.delay(duration=random.uniform(25, 40))

    # A couple of chains that take a while
    for _ in range(2):
        (slow_job.s(duration=random.uniform(15, 20))
         | normalize.s()
         | notify.s()).delay()

    remaining = args.count - 6
    weights = [3, 3, 2, 4, 1]
    kinds   = ["simple", "chain", "group", "flaky", "slow"]

    for i in range(remaining):
        kind = random.choices(kinds, weights=weights)[0]

        if kind == "simple":
            add.delay(random.randint(1, 100), random.randint(1, 100))
            label = "tasks.add"
        elif kind == "chain":
            send_chain()
            label = "chain: add | normalize | notify"
        elif kind == "group":
            send_group()
            label = "chord: group(add×N) | notify"
        elif kind == "flaky":
            flaky.delay(fail_rate=random.uniform(0.4, 0.9))
            label = "tasks.flaky"
        else:
            slow_job.delay(duration=random.uniform(3, 8))
            label = "tasks.slow_job"

        print(f"  [{i+1}/{remaining}] {label}")

    print("\nDone! Take screenshots now — slow tasks will stay STARTED for ~30s.")
    print("Open http://localhost:5556")


if __name__ == "__main__":
    main()
