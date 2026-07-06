async function getUrl() {
  try {
    const res = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (!res.ok) {
      console.log("ngrok API not ready yet...");
      return;
    }
    const data = await res.json();
    const publicUrl = data.tunnels?.[0]?.public_url;
    if (publicUrl) {
      console.log("PUBLIC_TUNNEL_URL=" + publicUrl);
    } else {
      console.log("No active tunnels found.");
    }
  } catch (err) {
    console.error("ngrok local API is offline:", err.message);
  }
}

getUrl();
