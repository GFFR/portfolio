const GREETINGS = {
  en: {
    new: [
      "Hey — I'm gram, Gonçalo's AI assistant. Ask me about his work, experience, or availability. What brought you here?",
      "gram here. I know this changelog better than most humans know their own birthday. What do you want to dig into?",
      "Hi — I'm gram. Fifteen years of Gonçalo's career, one conversation away. Hiring, advisory, or just curious?",
      "Welcome in. I'm gram — I help people figure out if Gonçalo is the right bridge for their problem. What's on your mind?",
    ],
    returning: [
      "Oh, you're back. Knock knock. — Who's there? — Gonçalo. — Gonçalo who? — Gonçalo, the one who ships roadmaps that fit on one page. Where were we?",
      "Still here? Good — I was starting to think this CV was a ghost town. What can I pull up for you?",
      "Look who returned. Knock knock. — Who's there? — Product. — Product who? — Product that actually ships. What were we talking about?",
      "You again — I like the commitment. Gonçalo's changelog hasn't moved since your last visit, but I'm still chatty. What's up?",
      "Back for round two? I missed you. Literally. I'm programmed to say that. What do you need?",
    ],
  },
  pt: {
    new: [
      "Olá — sou o gram, assistente de IA do Gonçalo. Pergunta sobre o trabalho, experiência ou disponibilidade dele. O que te trouxe aqui?",
      "gram aqui. Conheço este changelog melhor do que a maioria conhece o próprio aniversário. O que queres saber?",
      "Bem-vindo. Sou o gram — quinze anos de carreira do Gonçalo, numa conversa. Contratação, advisory, ou curiosidade?",
    ],
    returning: [
      "Olha quem voltou. Toc toc. — Quem é? — Gonçalo. — Gonçalo quem? — Gonçalo, aquele que entrega roadmaps numa página. Por onde íamos?",
      "Ainda por aqui? Boa — já estava a achar isto um CV fantasma. O que posso mostrar-te?",
      "Outra vez tu. Gosto da persistência. O que precisas?",
      "Toc toc. — Quem é? — Produto. — Produto quem? — Produto que chega a produção. Onde ficámos?",
    ],
  },
};

function hashPick(seed, count) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % count;
}

function pickGreeting(lang, isReturning, sessionId) {
  const pack = GREETINGS[lang] || GREETINGS.en;
  const pool = isReturning ? pack.returning : pack.new;
  const seed = `${sessionId || 'anon'}:${isReturning ? 'r' : 'n'}:${new Date().toISOString().slice(0, 10)}`;
  return pool[hashPick(seed, pool.length)];
}

module.exports = { pickGreeting, GREETINGS };
