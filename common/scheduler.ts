/**
 * @fileoverview An object that schedules events and delayed events in the chart
 * life cycle.
 *
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Disposable} from '@npm//@closure/disposable/disposable';
import * as events from '@npm//@closure/events/events';
import {Timer} from '@npm//@closure/timer/timer';

/**
 * Constructs a new scheduler. The scheduler, when asked for, performs a
 * countdown and invokes a given method when it reaches zero. The method will
 * not be invoked again until another countdown is initialized.
 * The point is that the method is invoked only once even if the countdown was
 * initialized a few times.
 * @unrestricted
 */
export class Scheduler extends Disposable {
  /** The callback function that will be called when countdown reaches zero. */
  private readonly callback: () => void;

  /** Keeps the countdown value in milliseconds. */
  private countdown: number = Infinity;

  /** Keeps the time in millis of the last time the callback was invoked. */
  private last = 0;

  /** The local timer. */
  private readonly timer: Timer;

  /**
   * @param callback The function that is called when countdown reaches zero.
   */
  constructor(callback: () => void) {
    super();

    this.callback = callback;

    // Set a timer to tick every 15 milliseconds.
    // This means that updateCountdown() requests only work for
    // countdown >= 15.
    const defaultLength = 15;
    const timer = new Timer(defaultLength);
    this.registerDisposable(timer);
    // Note that when the timer is disposed of, this event is removed.
    events.listen(timer, Timer.TICK, () => {
      this.tick();
    });

    this.timer = timer;
  }

  /**
   * Updates the countdown and by that asking for the callback to be called in
   * no longer than a given timeframe.
   * @param countdown The time, in milliseconds, afterwhich the callback must be
   *     invoked.
   */
  updateCountdown(countdown: number) {
    const oldCountdown = this.countdown;
    this.countdown = Math.min(this.countdown, countdown);
    if (!isFinite(this.countdown)) {
      // if the new countdown is Infinity, we want to stop the timer.
      this.timer.stop();
    } else if (!isFinite(oldCountdown)) {
      // otherwise, if the old countdown was Infinity and the new countdown is
      // finite, we want to start the timer.
      this.timer.start();
    }
  }

  /**
   * Stops the countdown. It will resume on the next call to updateCountdown().
   */
  stopCountdown() {
    this.countdown = Infinity;
    this.timer.stop();
  }

  /**
   * The internal tick method, takes care of counting down and invoking the
   * callback if needed.
   */
  private tick() {
    const now = Date.now();
    this.countdown -= now - this.last;
    this.last = now;
    if (this.countdown <= 0) {
      this.callback();
      this.countdown = Infinity;
      this.timer.stop();
    }
  }
}
