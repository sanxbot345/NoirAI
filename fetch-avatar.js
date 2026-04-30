import fs from 'fs';

async function searchImage() {
  try {
    const res = await fetch(`https://api.waifu.im/search?included_tags=waifu&is_nsfw=false`);
    const data = await res.json();
    if(data.images && data.images.length > 0) {
      console.log("Image URL:", data.images[0].url);
      
      const imgRes = await fetch(data.images[0].url);
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      
      fs.writeFileSync('avatar.b64', "data:image/jpeg;base64," + base64);
      console.log("Wrote to avatar.b64");
    }
  } catch (err) {
    console.error(err);
  }
}
searchImage();
