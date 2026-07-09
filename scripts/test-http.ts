async function run() {
  const url = 'http://localhost:3333/api/trpc/auth.me';
  console.log("Fetching:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Body:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
