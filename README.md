# Spectra Vision 👁️⚡
> **Intelligent Image & Document Parser** — An optical multimodal AI workspace engineered with Next.js and Google Gemini.

[![Live Demo](https://img.shields.io/badge/Live_Demo-spectra--vision--puce.vercel.app-000000?style=for-the-badge&logo=vercel)](https://spectra-vision-puce.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js_15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini_API-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

---

## 🌟 Overview

**Spectra Vision** is a specialized multimodal visual analysis workspace designed to parse, transcribe, and synthesize complex real-world visual inputs with speed and high precision. 

Built with Next.js and the official `@google/genai` SDK, it supports everything from handwritten notes and formal administrative letters to technical diagrams, schematics, and organizational logos.

🔗 **Live Deployment:** [spectra-vision-puce.vercel.app](https://spectra-vision-puce.vercel.app)

---

## ✨ Key Features

- **🔍 Multimodal Document & Vision Parsing:** Powered by the Google Gemini API to accurately transcribe handwritten letters, identify logos, extract tabular data, and summarize visual concepts.
- **⚡ Client-Side Canvas Compression:** High-resolution user uploads are automatically resized and compressed on an in-memory HTML5 Canvas before dispatch, preventing upload latency and payload limits.
- **🏷️ Content-Aware Session Titling:** AI automatically generates concise, descriptive 3–4 word titles based on what is detected inside the image (e.g., *"Student Contact Information Sheet"*, *"IEEE Region 10 Logo"*).
- **🗂️ Searchable Query History:** Persistent browser session storage with a quick-filter search bar to navigate, revisit, and inspect previous visual queries.
- **📋 One-Click Markdown Copy:** Formatted responses with structured headers and bullet points can be copied directly to your clipboard with a single click.
- **🌐 Optical Reticle Interface:** Clean, SaaS-grade light UI with technical grid lines, viewfinder focus animations, and pulsing optical sweeps.

---

## 🛠️ Architecture & Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, React 19) | Fast server-side routing & optimized client bundle |
| **AI SDK** | Google GenAI SDK (`@google/genai`) | Low-latency inference via Gemini Flash |
| **Styling** | Tailwind CSS | Modern SaaS-grade optical UI & responsive layout |
| **Markdown** | `react-markdown` | Rich formatted output for analysis & transcriptions |
| **Hosting** | Vercel | Automatic CI/CD serverless edge deployments |

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+ installed on your machine
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 1. Clone the repository
```bash
git clone [https://github.com/Chandanachandu0611-cloud/spectra-vision.git](https://github.com/Chandanachandu0611-cloud/spectra-vision.git)
cd spectra-vision