import type { Content } from "@google/genai";
import { ContextManager } from "./contextManager";

const messages: Content[] = [
  {
    role: "model",
    parts: [
      {
        functionCall: {
          name: "qnaTool",
          args: {
            questions: [
              {
                question:
                  "How would you rate your overall experience with React?",
                options: ["Very positive", "Positive", "Neutral", "Negative"],
                inputType: "select",
              },
              {
                options: [
                  "Very intuitive",
                  "Somewhat intuitive",
                  "A bit confusing",
                  "Very difficult",
                ],
                question:
                  "How do you feel about the complexity of React hooks?",
                inputType: "select",
              },
              {
                question:
                  "How much do you enjoy working with the React ecosystem (libraries, tools, etc.)?",
                options: ["Love it", "Like it", "It's okay", "Don't like it"],
                inputType: "select",
              },
            ],
            summary:
              "Overall_experience_rate##<ANSWER_PLACEHOLDER>::Hooks_complexity_feeling##<ANSWER_PLACEHOLDER>::Ecosystem_enjoyment##<ANSWER_PLACEHOLDER>",
          },
          id: "1tk9v3e4",
        },
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        functionCall: {
          name: "updatePlan",
          args: {
            summary:
              "PENDING##Plan to fit an elephant in a room##Select a room::Shrink the elephant::Transport the elephant::Monitor the elephant",
            explanation:
              "A four-step plan to achieve the impossible task of fitting an elephant into a room using creative and unconventional methods.",
            plan: [
              {
                status: "completed",
                step: "Select an exceptionally large room or a magical spatial dimension.",
              },
              {
                step: "Apply advanced shrinking technology to reduce the elephant's physical size.",
                status: "completed",
              },
              {
                step: "Carefully transport the shrunken elephant into the chosen room.",
                status: "completed",
              },
              {
                step: "Monitor the elephant to ensure it remains at the appropriate size for the space.",
                status: "completed",
              },
            ],
          },
          id: "ktntfa2r",
        },
      },
    ],
  },
  {
    role: "user",
    parts: [
      {
        functionResponse: {
          name: "qnaTool",
          response: {
            userAnswer: [
              {
                question:
                  "How would you rate your overall experience with React?",
                selectedOption: "Neutral",
              },
              {
                question:
                  "How do you feel about the complexity of React hooks?",
                selectedOption: "Very difficult",
              },
              {
                question:
                  "How much do you enjoy working with the React ecosystem (libraries, tools, etc.)?",
                selectedOption: "Love it",
              },
            ],
            summary:
              "Overall_experience_rate##<ANSWER_PLACEHOLDER>::Hooks_complexity_feeling##<ANSWER_PLACEHOLDER>::Ecosystem_enjoyment##<ANSWER_PLACEHOLDER>",
          },
        },
      },
    ],
  },
  {
    role: "user",
    parts: [
      {
        functionResponse: {
          name: "listFile",
          response: {
            list: [
              {
                path: "index.html",
                content:
                  '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Editable React Project</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
              },
              {
                path: "package.json",
                content:
                  '{\n  "name": "editable-react-project",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "dev": "vite --host 0.0.0.0 --port 5174",\n    "build": "tsc -b && vite build",\n    "preview": "vite preview --port 5174"\n  },\n  "dependencies": {\n    "@vitejs/plugin-react": "^4.3.4",\n    "vite": "^6.0.7",\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  },\n  "devDependencies": {\n    "@types/react": "^19.0.7",\n    "@types/react-dom": "^19.0.3",\n    "typescript": "^5.7.3"\n  }\n}\n',
              },
              {
                path: "src/App.tsx",
                content:
                  "import React from 'react';\nimport { PricingCard } from './PricingCard';\n\nconst plans = [\n  {\n    name: 'Basic',\n    price: '$9/mo',\n    features: ['10 prompts/mo', 'Standard support', 'Community access'],\n    cta: 'Buy Now',\n  },\n  {\n    name: 'Standard',\n    price: '$29/mo',\n    features: ['50 prompts/mo', 'Priority support', 'Advanced tools'],\n    cta: 'Buy Now',\n  },\n  {\n    name: 'Premium',\n    price: '$99/mo',\n    features: ['Unlimited prompts', '24/7 support', 'Full API access'],\n    cta: 'Buy Now',\n  },\n];\n\nconst features = [\"Prompt-driven edits\", \"Live React preview\", \"File tools\"];\n\nexport function App() {\n  return (\n    <main className=\"project-page\">\n      <section className=\"hero\">\n        <p className=\"kicker\">Editable project folder</p>\n        <h1>Tool call is updating the app</h1>\n        <p className=\"lede\">\n          This is the target React project. The main assignment app should\n          inspect these files, ask Gemini what to change, write updates here,\n          and show the running preview.\n        </p>\n        <div className=\"feature-row\">\n          {features.map((feature) => (\n            <span key={feature}>{feature}</span>\n          ))}\n        </div>\n      </section>\n\n      <section className=\"pricing-section\">\n        <h2>Choose Your Plan</h2>\n        <div className=\"pricing-grid\">\n          {plans.map((plan) => (\n            <PricingCard key={plan.name} {...plan} />\n          ))}\n        </div>\n      </section>\n    </main>\n  );\n}\n",
              },
              {
                path: "src/main.tsx",
                content:
                  'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport "./styles.css";\nimport { App } from "./App";\n\ncreateRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n',
              },
              {
                path: "src/PricingCard.tsx",
                content:
                  'import React from \'react\';\n\ninterface PricingCardProps {\n  name: string;\n  price: string;\n  features: string[];\n  cta: string;\n}\n\nexport function PricingCard({ name, price, features, cta }: PricingCardProps) {\n  return (\n    <div className="pricing-card">\n      <h3 className="plan-name">{name}</h3>\n      <p className="plan-price">{price}</p>\n      <ul className="plan-features">\n        {features.map((feature) => (\n          <li key={feature}>{feature}</li>\n        ))}\n      </ul>\n      <button className="pricing-cta">{cta}</button>\n    </div>\n  );\n}\n',
              },
              {
                path: "src/styles.css",
                content:
                  ':root {\n  background: #f8f4e7;\n  color: #211d18;\n  font-family: Avenir, "Gill Sans", system-ui, sans-serif;\n  line-height: 1.5;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n}\n\n.project-page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  padding: 40px;\n  background:\n    radial-gradient(circle at 10% 10%, rgba(205, 255, 86, 0.55), transparent 28%),\n    linear-gradient(135deg, #f8f4e7 0%, #e7f0ff 100%);\n}\n\n.hero {\n  width: min(880px, 100%);\n  border: 2px solid #211d18;\n  background: rgba(255, 253, 246, 0.9);\n  padding: clamp(28px, 6vw, 72px);\n  box-shadow: 14px 14px 0 #211d18;\n}\n\n.kicker {\n  margin: 0 0 12px;\n  font-size: 13px;\n  font-weight: 800;\n  letter-spacing: 0;\n  text-transform: uppercase;\n}\n\nh1 {\n  max-width: 760px;\n  margin: 0;\n  font-size: clamp(42px, 8vw, 88px);\n  line-height: 0.95;\n}\n\n.lede {\n  max-width: 680px;\n  margin: 24px 0 0;\n  color: #5f584e;\n  font-size: 18px;\n}\n\n.feature-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  margin-top: 28px;\n}\n\n.feature-row span {\n  border: 1px solid #211d18;\n  background: #cdff56;\n  padding: 8px 10px;\n  font-size: 13px;\n  font-weight: 800;\n}\n',
              },
              {
                path: "tsconfig.json",
                content:
                  '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["DOM", "DOM.Iterable", "ES2020"],\n    "allowJs": false,\n    "skipLibCheck": true,\n    "esModuleInterop": true,\n    "allowSyntheticDefaultImports": true,\n    "strict": true,\n    "forceConsistentCasingInFileNames": true,\n    "module": "ESNext",\n    "moduleResolution": "Bundler",\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx"\n  },\n  "include": ["src"]\n}\n',
              },
              {
                path: "vite.config.ts",
                content:
                  'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    port: 5174,\n  },\n});\n',
              },
            ],
          },
        },
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        functionCall: {
          name: "writeFile",
          args: {
            path: "src/PricingCard.tsx",
            content:
              'import React from \'react\';\n\ninterface PricingCardProps {\n  name: string;\n  price: string;\n  features: string[];\n  cta: string;\n}\n\nexport function PricingCard({ name, price, features, cta }: PricingCardProps) {\n  return (\n    <div className="pricing-card">\n      <h3 className="plan-name">{name}</h3>\n      <p className="plan-price">{price}</p>\n      <ul className="plan-features">\n        {features.map((feature) => (\n          <li key={feature}>{feature}</li>\n        ))}\n      </ul>\n      <button className="pricing-cta">{cta}</button>\n    </div>\n  );\n}\n',
          },
          id: "738c2byz",
        },
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        functionCall: {
          name: "readFile",
          args: {
            path: "src/App.tsx",
          },
          id: "g1e6w8ap",
        },
      },
    ],
  },
  {
    role: "user",
    parts: [
      {
        functionResponse: {
          name: "readFile",
          response: {
            file: "src/App.tsx",
            content:
              'const features = ["Prompt-driven edits", "Live React preview", "File tools"];\n\nexport function App() {\n  return (\n    <main className="project-page">\n      <section className="hero">\n        <p className="kicker">Editable project folder</p>\n        <h1>Tool call is updating the app</h1>\n        <p className="lede">\n          This is the target React project. The main assignment app should\n          inspect these files, ask Gemini what to change, write updates here,\n          and show the running preview.\n        </p>\n        <div className="feature-row">\n          {features.map((feature) => (\n            <span key={feature}>{feature}</span>\n          ))}\n        </div>\n      </section>\n    </main>\n  );\n}\n',
          },
        },
      },
    ],
  },
  {
    role: "user",
    parts: [
      {
        functionResponse: {
          name: "writeFile",
          response: {
            file: "src/PricingCard.tsx",
            write: true,
          },
        },
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        functionCall: {
          name: "listFile",
          args: {},
          id: "3xoyk8a8",
        },
      },
    ],
  },
];

const ctx = new ContextManager(1);
const cmp = ctx.compactHistory(messages);
