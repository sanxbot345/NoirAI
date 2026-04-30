import fs from 'fs';

async function searchImage() {
  try {
    const res = await fetch(`https://image.pollinations.ai/prompt/gorgeous%20dark%20anime%20girl%20hacker%20red%20theme%20black%20hair%20cool%20confident%20pose%20close%20up%20profile%20picture%20masterpiece?width=512&height=512&nologo=true&seed=8888`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Size:", buffer.length);
  } catch (err) {
    console.error(err);
  }
}
searchImage();
