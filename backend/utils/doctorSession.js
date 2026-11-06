// A doctor's daily status flags (isArrived, sessionStarted) live on the Doctor document and are
// only reset when the reception dashboard runs its daily sync. Read them through these helpers so
// yesterday's flags, or a session left running after the doctor was checked out, never show
// patients a live queue.

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

// True when the doctor was checked in today (hospital time zone, see config/timezone.js)
export const isArrivedToday = (doc, now = new Date()) =>
  Boolean(doc?.isArrived && doc.lastArrivalDate && isSameDay(new Date(doc.lastArrivalDate), now));

// Call before recording a new check-in: a session left running on an earlier day is dropped,
// so it cannot carry over into today's queue.
export const clearStaleSession = (doc, now = new Date()) => {
  const last = doc?.lastArrivalDate ? new Date(doc.lastArrivalDate) : null;
  if (last && isSameDay(last, now)) return;
  doc.sessionStarted = false;
  doc.currentQueueNumber = 0;
};

// The queue is live only while the doctor is checked in today and the session has been started
export const isSessionLive = (doc, now = new Date()) =>
  Boolean(doc?.sessionStarted && isArrivedToday(doc, now));
