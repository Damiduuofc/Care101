// All "start of day" / "end of day" maths in the backend uses the server's local time.
// Pin it to the hospital's time zone so bookings near midnight land on the right day
// even when the server itself runs in UTC. Must be imported before any route module.
process.env.TZ = process.env.HOSPITAL_TZ || "Asia/Colombo";
