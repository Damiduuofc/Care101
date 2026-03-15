import fetch from "node-fetch";

async function testFetch() {
  const result = await fetch("http://localhost:5000/api/schedule-requests/pending");
  console.log(result.status);
}
testFetch();
