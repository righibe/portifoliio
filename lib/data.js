// All portfolio content, bilingual (en/pt). Consumed by the canvas engine.
export const PORTFOLIO = {
  sections: {
    about: {
      kicker: { en: "Player profile", pt: "Perfil do jogador" },
      title: { en: "Beyond the code.", pt: "Além do código." },
      text: {
        en: "The human side of the terminal — where I come from, what I love and what keeps me curious.",
        pt: "O lado humano do terminal — de onde eu venho, o que eu amo e o que me mantém curioso."
      },
      // RPG-style character sheet (the "game" touch)
      player: {
        name: "Bernardo Righi",
        klass: { en: "Backend Mage · CS Student", pt: "Mago do Back-end · Estudante de CC" },
        stats: [
          { label: "Python", value: 90 },
          { label: "Java / Spring", value: 72 },
          { label: "ML & Data", value: 74 },
          { label: { en: "Coffee", pt: "Café" }, value: 100 }
        ],
        achievements: [
          { icon: "🏆", text: { en: "Top 6 BR dev community", pt: "Top 6 comunidade dev BR" } },
          { icon: "🔬", text: { en: "R&D with Dell @ Unisinos", pt: "P&D com a Dell na Unisinos" } },
          { icon: "🚀", text: { en: "Found this site's spaceship?", pt: "Já achou a nave deste site?" } }
        ]
      },
      cards: [
        {
          type: "family",
          icon: "fa-solid fa-dna",
          title: { en: "Researcher DNA", pt: "DNA de pesquisador" },
          desc: {
            en: "My love for tech comes from home: my dad, Rodrigo da Rosa Righi, is a Computer Science professor and researcher — senior member of IEEE and ACM, postdoc at KAIST (South Korea) and 100+ published papers. I grew up hearing about cloud, IoT and supercomputers at dinner. There was no escaping it. 😄",
            pt: "Minha paixão por tecnologia vem de casa: meu pai, Rodrigo da Rosa Righi, é professor e pesquisador em Computação — membro sênior do IEEE e da ACM, pós-doc no KAIST (Coreia do Sul) e mais de 100 artigos publicados. Cresci ouvindo sobre cloud, IoT e supercomputadores no jantar. Não tinha como escapar. 😄"
          },
          link: {
            href: "https://www.linkedin.com/in/rodrigo-righi-961563150/",
            label: { en: "Meet my dad", pt: "Conheça meu pai" }
          }
        },
        {
          type: "anime",
          icon: "fa-solid fa-fire",
          title: { en: "Anime between deploys", pt: "Anime entre um deploy e outro" },
          desc: {
            en: "Off the terminal, I'm marathoning anime. Naruto is the classic — the whole \"outwork the talented\" philosophy hits hard when you're learning to code. Believe it. 🍥",
            pt: "Fora do terminal, tô maratonando anime. Naruto é o clássico — aquela filosofia de \"treino vence talento\" bate forte em quem tá aprendendo a programar. Believe it. 🍥"
          }
        },
        {
          type: "creator",
          icon: "fa-solid fa-clapperboard",
          title: { en: "Creator mode: ON", pt: "Modo criador: ON" },
          desc: {
            en: "In 2026 I started creating programming & CS content on Instagram and TikTok — explaining things the way I wish someone had explained them to me.",
            pt: "Em 2026 comecei a criar conteúdo de programação e computação no Instagram e TikTok — explicando as coisas do jeito que eu queria que tivessem me explicado."
          },
          link: {
            href: "https://www.instagram.com/righi._/",
            label: { en: "Follow along", pt: "Cola lá" }
          }
        },
        {
          type: "teach",
          icon: "fa-solid fa-chalkboard-user",
          title: { en: "Side quest: teaching English", pt: "Side quest: ensinar inglês" },
          desc: {
            en: "I teach English on the side. Turns out explaining grammar makes you better at explaining code too. EN fluent · ES intermediate.",
            pt: "Dou aula de inglês nas horas vagas. Explicar gramática me deixou melhor em explicar código também. EN fluente · ES intermediário."
          }
        },
        {
          type: "drive",
          icon: "fa-solid fa-magnifying-glass-chart",
          title: { en: "What drives me", pt: "O que me move" },
          desc: {
            en: "Understanding what happens under the hood — from APIs and ML models down to algorithms, architecture and performance. The academic side and the real-world side, both.",
            pt: "Entender o que acontece por baixo do capô — de APIs e modelos de ML até algoritmos, arquitetura e performance. O lado acadêmico e o do mundo real, os dois."
          }
        }
      ]
    },
    journey: {
      kicker: { en: "Flight log", pt: "Diário de bordo" },
      title: { en: "The journey so far.", pt: "A trajetória até aqui." },
      text: {
        en: "A short flight log of the milestones that shaped me as a developer.",
        pt: "Um breve diário de bordo dos marcos que me formaram como desenvolvedor."
      },
      timeline: [
        {
          date: { en: "May 2023", pt: "Maio de 2023" },
          icon: "fa-brands fa-discord",
          title: { en: "Co-founded Servidor dos Programadores", pt: "Cofundei o Servidor dos Programadores" },
          desc: {
            en: "Launched one of Brazil's largest developer communities on Discord together with a friend.",
            pt: "Criei, junto com um amigo, uma das maiores comunidades de devs do Brasil no Discord."
          }
        },
        {
          date: { en: "December 2023", pt: "Dezembro de 2023" },
          icon: "fa-solid fa-code",
          title: { en: "Started programming", pt: "Comecei a programar" },
          desc: {
            en: "Wrote my first lines of code and fell for building things — the beginning of everything.",
            pt: "Escrevi minhas primeiras linhas de código e me apaixonei por construir coisas — o começo de tudo."
          }
        },
        {
          date: { en: "March 2026", pt: "Março de 2026" },
          icon: "fa-solid fa-graduation-cap",
          title: { en: "Computer Science at Unisinos", pt: "Ciência da Computação na Unisinos" },
          desc: {
            en: "Started my Computer Science degree at Unisinos, turning curiosity into formal engineering.",
            pt: "Iniciei a graduação em Ciência da Computação na Unisinos, transformando curiosidade em engenharia."
          }
        },
        {
          date: { en: "June 2026", pt: "Junho de 2026" },
          icon: "fa-solid fa-flask",
          title: { en: "Junior research assistant at Unisinos · Dell project", pt: "Pesquisador na Unisinos · projeto Dell" },
          desc: {
            en: "Joined my university's research team on a Dell project, applying engineering to real-world R&D.",
            pt: "Entrei na equipe de pesquisa da minha faculdade em um projeto da Dell, aplicando engenharia em P&D do mundo real."
          }
        }
      ]
    },
    skills: {
      kicker: { en: "Capability cluster", pt: "Cluster de habilidades" },
      title: { en: "Back-end stack, automation and AI tooling.", pt: "Stack back-end, automação e ferramentas de IA." },
      text: {
        en: "Tools I use to build APIs, bots, data flows, integrations and production-minded applications.",
        pt: "Ferramentas que uso para criar APIs, bots, fluxos de dados, integrações e aplicações com mentalidade de produção."
      },
      groups: [
        ["Python", { en: "Django, Flask, scripts, bots and automations", pt: "Django, Flask, scripts, bots e automações" }],
        ["Java", { en: "OOP, CRUD, services and application structure", pt: "OOP, CRUD, serviços e estrutura de aplicação" }],
        ["Spring Boot", { en: "REST services, layers and enterprise patterns", pt: "Serviços REST, camadas e padrões enterprise" }],
        [{ en: "AI, ML & LLMs", pt: "IA, ML & LLMs" }, { en: "Scikit-learn, embeddings, OpenAI, LangChain and RAG flows", pt: "Scikit-learn, embeddings, OpenAI, LangChain e fluxos RAG" }],
        [{ en: "Databases", pt: "Bancos de dados" }, { en: "SQL, SQLite, PostgreSQL, modeling and query organization", pt: "SQL, SQLite, PostgreSQL, modelagem e organização de consultas" }],
        ["REST APIs", { en: "Routes, auth, integrations and response design", pt: "Rotas, autenticação, integrações e desenho de respostas" }],
        ["Docker", { en: "Containerized local environments and deploy support", pt: "Ambientes locais em containers e suporte a deploy" }],
        ["GitHub Actions", { en: "CI/CD workflows, checks and automated delivery", pt: "Fluxos CI/CD, checks e entrega automatizada" }],
        ["Linux", { en: "Shell, server basics and development workflow", pt: "Shell, base de servidores e fluxo de desenvolvimento" }]
      ]
    },
    leadership: {
      kicker: { en: "Social signal", pt: "Sinal social" },
      title: { en: "Technical leadership beyond the developer.", pt: "Liderança técnica além do dev." },
      text: {
        en: "Co-founder and manager of one of Brazil's largest programming communities, responsible for organization, developer support and strategic partnerships.",
        pt: "Cofundador e gestor de uma das maiores comunidades de programação do Brasil, responsável por organização, suporte a devs e parcerias estratégicas."
      },
      groups: [
        [{ en: "Community architecture", pt: "Arquitetura de comunidade" }, { en: "Events, moderation and technical operations", pt: "Eventos, moderação e operação técnica" }],
        [{ en: "Mentorship", pt: "Mentoria" }, { en: "Guidance for developers growing their careers", pt: "Orientação para devs evoluindo na carreira" }],
        [{ en: "Partnerships", pt: "Parcerias" }, { en: "Collaborations with education and infrastructure brands", pt: "Parcerias com marcas de educação e infraestrutura" }]
      ],
      links: [
        ["Alura", "https://www.alura.com.br", { en: "Online education platform", pt: "Plataforma de educação online" }],
        ["Hostinger", "https://www.hostinger.com.br", { en: "Hosting & infrastructure", pt: "Hospedagem e infraestrutura" }]
      ]
    },
    projects: {
      kicker: { en: "Realized projects", pt: "Projetos realizados" },
      title: { en: "Projects with practical engineering decisions.", pt: "Projetos com decisões práticas de engenharia." },
      text: {
        en: "A compact view of projects involving automation, AI, CRUD architecture and delivery workflows.",
        pt: "Uma visão compacta de projetos com automação, IA, arquitetura CRUD e fluxos de entrega."
      },
      projects: ["predictprices", "supportagent", "cicd", "aibot", "questbot", "cadastro", "django"]
    },
    contact: {
      kicker: { en: "Open channel", pt: "Canal aberto" },
      title: { en: "Let's talk.", pt: "Fala comigo!" },
      text: {
        en: "Software engineer and tech content creator, open to projects, collaborations and opportunities involving back-end engineering, automation and AI.",
        pt: "Engenheiro de software e criador de conteúdo tech, aberto a projetos, colaborações e oportunidades envolvendo back-end, automação e IA."
      },
      links: [
        ["Email", "bernardomicolrighi@outlook.com", "mailto:bernardomicolrighi@outlook.com", "fa-solid fa-envelope"],
        [{ en: "Academic Email", pt: "E-mail Acadêmico" }, "brighi@edu.unisinos.br", "mailto:brighi@edu.unisinos.br", "fa-solid fa-building-columns"],
        ["LinkedIn", "Bernardo Righi", "https://www.linkedin.com/in/bernardo-righi/", "fa-brands fa-linkedin"],
        ["Instagram", "@righi._", "https://www.instagram.com/righi._/", "fa-brands fa-instagram"],
        ["WhatsApp", "+55 51 996 011 501", "https://wa.me/5551996011501", "fa-brands fa-whatsapp"]
      ]
    }
  },
  projects: {
    predictprices: {
      icon: "fa-solid fa-chart-line",
      title: { en: "SP Real Estate Price Predictor", pt: "Predição de Preços de Imóveis SP" },
      tagline: { en: "ML model that estimates São Paulo property prices from real listing features.", pt: "Modelo de ML que estima preços de imóveis em São Paulo a partir de dados reais." },
      desc: { en: "Machine Learning application that predicts house and apartment prices in São Paulo. Uses property features like area, rooms, bathrooms, parking spots, property tax (IPTU) and condo fees to estimate sale value. Trains multiple Decision Tree models with varying depths and evaluates each using Mean Absolute Error (MAE) to select the best configuration.", pt: "Aplicação de Machine Learning que prevê preços de casas e apartamentos em São Paulo. Utiliza características do imóvel como área útil, quartos, banheiros, vagas de garagem, IPTU e taxa de condomínio para estimar o valor de venda. Treina múltiplos modelos de Árvore de Decisão com diferentes profundidades e avalia cada um usando Erro Médio Absoluto (MAE) para selecionar a melhor configuração." },
      impact: { en: "Demonstrates end-to-end ML pipeline: data cleaning, feature engineering, model training, hyperparameter tuning and evaluation on a real-world dataset.", pt: "Demonstra pipeline completo de ML: limpeza de dados, engenharia de features, treinamento de modelos, ajuste de hiperparâmetros e avaliação em dataset real." },
      tech: ["Python", "Machine Learning", "Decision Trees", "Pandas"],
      link: "https://github.com/righibe/predict-prices-sp"
    },
    supportagent: {
      icon: "fa-solid fa-headset",
      title: { en: "AI Technical Support Agent", pt: "Agente de Suporte Técnico com IA" },
      tagline: { en: "GPT-4o agent that resolves user issues via tool-calling and conversation memory.", pt: "Agente GPT-4o que resolve problemas com tool-calling e memória de conversa." },
      desc: { en: "Intelligent technical support agent powered by GPT-4o that handles user issues through natural conversation. Features tool-calling capabilities, context-aware responses based on conversation history, and structured problem-solving workflows. Designed to simulate a real support experience with memory and actionable suggestions.", pt: "Agente inteligente de suporte técnico com GPT-4o que resolve problemas do usuário através de conversa natural. Possui capacidade de chamada de ferramentas (tool calling), respostas contextuais baseadas no histórico da conversa e fluxos estruturados de resolução de problemas. Projetado para simular uma experiência real de suporte com memória e sugestões acionáveis." },
      impact: { en: "Shows practical use of LLM agents with tool integration, conversation memory and structured output for enterprise-grade support automation.", pt: "Demonstra uso prático de agentes LLM com integração de ferramentas, memória de conversa e saída estruturada para automação de suporte corporativo." },
      tech: ["Python", "GPT-4o", "LangChain", "AI Agents"],
      link: "https://github.com/righibe/technical-suport-Agent"
    },
    cicd: {
      icon: "fa-brands fa-github",
      title: "CI/CD Pipeline in Python",
      tagline: { en: "GitHub Actions pipeline automating lint, tests and the deploy flow of a Python app.", pt: "Pipeline com GitHub Actions automatizando lint, testes e deploy de uma app Python." },
      desc: { en: "Automated GitHub Actions pipeline for linting, tests and deployment flow in a Python application.", pt: "Pipeline automatizado com GitHub Actions para linting, testes e fluxo de deploy em uma aplicação Python." },
      impact: { en: "Makes validation repeatable and catches issues before release.", pt: "Torna a validação repetível e encontra problemas antes da entrega." },
      tech: ["Python", "GitHub Actions", "CI/CD"],
      link: "https://github.com/righibe/ci-cd-pipeline-python"
    },
    aibot: {
      icon: "fa-brands fa-discord",
      title: "Generative AI Discord Bot",
      tagline: { en: "Discord bot wired to generative AI APIs for contextual answers in real time.", pt: "Bot de Discord ligado a APIs de IA generativa para respostas contextuais em tempo real." },
      desc: { en: "Discord bot connected to generative AI APIs for contextual real-time answers.", pt: "Bot de Discord conectado a APIs de IA generativa para respostas contextuais em tempo real." },
      impact: { en: "Adds AI support directly inside a community server.", pt: "Leva suporte com IA direto para dentro de uma comunidade." },
      tech: ["Python", "Discord.py", "LLMs"],
      link: "https://github.com/righibe/bot-discord-IAgenerativa"
    },
    questbot: {
      icon: "fa-solid fa-fire",
      title: "English Streak Discord Bot",
      tagline: { en: "Duolingo-style Discord bot teaching technical English with daily streaks and rankings.", pt: "Bot de Discord no estilo Duolingo para ensinar inglês técnico com streaks diárias e rankings." },
      desc: { en: "Discord bot with daily button-based challenges, points, streaks and server and global leaderboards.", pt: "Bot de Discord com desafios diários por botões, pontos, streaks e rankings de servidor e globais." },
      impact: { en: "Gamifies learning technical English for developers right inside a server.", pt: "Gamifica o aprendizado de inglês técnico para devs dentro do próprio servidor." },
      tech: ["TypeScript", "discord.js", "PostgreSQL"],
      link: "https://github.com/righibe/bot-quetionario-en"
    },
    cadastro: {
      icon: "fa-brands fa-java",
      title: "User Management System",
      tagline: { en: "Java CRUD app built with object-oriented principles for user management.", pt: "App CRUD em Java com princípios de orientação a objetos para gestão de usuários." },
      desc: { en: "Java CRUD application built with OOP principles for user registration and management.", pt: "Aplicação CRUD em Java com princípios de OOP para cadastro e gestão de usuários." },
      impact: { en: "Shows clean entities, validation and CRUD behavior.", pt: "Mostra entidades, validação e comportamento CRUD de forma limpa." },
      tech: ["Java", "OOP", "CRUD"],
      link: "https://github.com/righibe/Cadastro-pessoas"
    },
    django: {
      icon: "fa-brands fa-python",
      title: "Django User Management",
      tagline: { en: "Full user CRUD on the Django ORM with clean routing and organized structure.", pt: "CRUD completo de usuários no Django ORM com rotas limpas e estrutura organizada." },
      desc: { en: "Full CRUD user management using Django ORM, routing and clean application structure.", pt: "CRUD completo de usuários usando Django ORM, rotas e estrutura organizada." },
      impact: { en: "Connects Python back-end skills with database-driven web apps.", pt: "Conecta back-end em Python com aplicações web orientadas a banco de dados." },
      tech: ["Python", "Django", "ORM"],
      link: "https://github.com/righibe/CRUD-Python-Django"
    }
  }
};
