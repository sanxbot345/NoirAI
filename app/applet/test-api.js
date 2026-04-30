const { OpenAI } = require('openai');

async function testEndpoint(baseURL, model) {
  const openai = new OpenAI({
    apiKey: "sk-567186ed5d74487183910690a51c4a90",
    baseURL
  });

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 5
    });
    console.log(`SUCCESS with ${baseURL}`);
    return true;
  } catch (err) {
    console.log(`FAILED with ${baseURL}: ${err.message}`);
    return false;
  }
}

async function run() {
  const endpoints = [
    { url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    { url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    { url: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" }
  ];

  for (const ep of endpoints) {
    await testEndpoint(ep.url, ep.model);
  }
}

run();
