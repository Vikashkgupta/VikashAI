// File: src/data/customKnowledge.js
// 👉 Vikash Kumar Gupta की संपूर्ण व्यक्तिगत, शैक्षणिक (School & College), ट्रेनिंग/अवार्ड्स और तकनीकी जानकारी।
// Vikash AI इस फाइल को पढ़कर हर सवाल का सटीक जवाब देता है।

export const VIKASH_CUSTOM_KNOWLEDGE = {
  // 1. बेसिक परिचय
  aboutMe: `
नाम: Vikash Kumar Gupta (विकास कुमार गुप्ता)
भूमिका: MERN Stack Developer | B.Tech AIML Student | Full-Stack Web & AI Developer
गृह नगर: Mairwa Dham / Nai Bazar, Mairwa (Siwan), Bihar, India
वर्तमान अध्ययन स्थान: Barabanki, Uttar Pradesh, India
ईमेल: vikashkumargupta1000@gmail.com
विशेष नोट: मैंने 10वीं (2021) के बाद सीधे 3-वर्षीय पॉलिटेक्निक डिप्लोमा (CSE) किया और फिर लेटरल एंट्री से B.Tech (AIML) कर रहा हूँ (12th नहीं किया है)।
  `.trim(),

  // 2. संपूर्ण शिक्षा यात्रा (Nursery से B.Tech तक — क्रमवार)
  education: [
    {
      level: 'B.Tech (Graduation — Pursuing)',
      course: 'Bachelor of Technology (B.Tech) in Artificial Intelligence & Machine Learning (AIML)',
      institute: 'Sagar Institute of Technology & Management (SITM), Barabanki',
      collegeGroup: 'Sagar Group of Institutions, Barabanki',
      boardOrUniversity: 'Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow, Uttar Pradesh',
      duration: '2025 – 2028 (Lateral Entry after Diploma)',
      status: 'Currently Pursuing',
      highlights: 'Artificial Intelligence, Machine Learning, MERN Stack Development, Hackathons & Real-World AI Projects'
    },
    {
      level: 'Diploma (Polytechnic — 3 Years)',
      course: 'Diploma in Computer Science & Engineering (CSE)',
      institute: 'Government Polytechnic Unnao, Uttar Pradesh',
      boardOrUniversity: 'Board of Technical Education Uttar Pradesh (BTEUP)',
      duration: '2021 – 2024 (3 Years)',
      passingYear: '2024',
      percentage: '70%',
      highlights: '10वीं के बाद सीधे कंप्यूटर साइंस एंड इंजीनियरिंग में 3 साल का डिप्लोमा 70% अंकों के साथ पूरा किया।'
    },
    {
      level: 'High School (Class 6th to 10th)',
      course: 'Class 6th to 10th (High School)',
      institute: 'Sant Digambar Nath Higher Secondary School, Pachrukhiya Balua, Deoria, Uttar Pradesh',
      formerSchoolName: 'Shri Balaji Shikshan Sansthan (कक्षा 5वीं तक स्कूल का नाम श्री बालाजी शिक्षण संस्थान था, और 6वीं से इसका नाम संत दिगंबर नाथ हायर सेकेंडरी स्कूल पड़ा)',
      boardOrUniversity: 'UP Board (Uttar Pradesh)',
      passingYear: '2021',
      percentage: '84.3%',
      highlights: '10वीं की परीक्षा 2021 में 84.3% अंकों के साथ उत्तीर्ण की (12वीं के बजाय सीधे कंप्यूटर साइंस डिप्लोमा चुना)।'
    },
    {
      level: 'Primary School (Nursery to Class 5th)',
      course: 'Nursery to Class 5th',
      institute: 'Girls Primary School, Mairwa Dham (मैरवा धाम), Siwan, Bihar',
      passingYear: '2015',
      highlights: 'प्रारंभिक शिक्षा नर्सरी से 5वीं कक्षा तक मैरवा धाम के गर्ल्स प्राइमरी स्कूल से 2015 में पूरी की।'
    }
  ],

  // 3. इंडस्ट्रियल ट्रेनिंग और अवार्ड्स (Summer Trainings & Awards)
  trainingsAndAwards: [
    {
      title: '45 Days Summer Training in ASP.NET with MVC',
      organization: 'Makartaj Private Limited',
      when: 'After 2nd Year of Diploma (CSE)',
      duration: '45 Days',
      technology: 'ASP.NET with MVC, C#, Web Application Development',
      award: 'Best Performer Award (बेस्ट परफॉर्मर अवार्ड से सम्मानित)'
    },
    {
      title: '45 Days Summer Training in Python with Django',
      organization: 'SoftPro India',
      when: 'After 1st Year of Diploma (CSE)',
      duration: '45 Days',
      technology: 'Python, Django Web Framework, Backend Development'
    }
  ],

  // 4. तकनीकी कौशल (Technical Skills)
  skills: [
    'MERN Stack (MongoDB, Express.js, React.js, Node.js)',
    'JavaScript (ES6+), HTML5 & Tailwind CSS',
    'Python & Django',
    'ASP.NET MVC & C#',
    'Artificial Intelligence & Machine Learning (AIML)',
    'Netlify Serverless Functions & Supabase (PostgreSQL)',
    'Gemini AI API, SSE Streaming & Prompt Engineering',
    'Git & GitHub'
  ],

  // 5. प्रमुख प्रोजेक्ट्स और उपलब्धियाँ
  highlights: [
    'Makartaj Private Limited में 45-दिवसीय ASP.NET with MVC ट्रेनिंग के दौरान "Best Performer Award" प्राप्त किया।',
    'SoftPro India में 45-दिवसीय Python with Django ट्रेनिंग पूरी की।',
    'KshirSagar Sweets & Bakers (Mairwa) — फुल-स्टैक ई-कॉमर्स वेब ऐप और Laddu AI (लाइव लोकेशन व कार्ट कंट्रोलर AI) बनाया।',
    'Vikash AI — GitHub और Instagram Graph API से जुड़ा लाइव पर्सनल AI असिस्टेंट बनाया।',
    'E-Village Web Application — ASP.NET MVC पर आधारित ग्रामीण डिजिटल सेवा वेब ऐप।',
    'Farmer–Merchant Integration Platform — Python और Django पर आधारित किसान-व्यापारी प्लेटफॉर्म।'
  ],

  // 6. प्रोफाइल और सोशल लिंक्स (Verified Contact Info)
  extraProfiles: {
    instagram: 'https://www.instagram.com/_vikashkgupta/',
    facebook: 'https://www.facebook.com/vikash.kumar.gupta.289183',
    portfolio: 'https://vikashkumargupta.netlify.app',
    github: 'https://github.com/Vikashkgupta',
    linkedin: 'https://www.linkedin.com/in/vikash-kumargupta',
    linktree: 'https://linktr.ee/vikashgupta',
    replit: 'https://replit.com/@vikashgupta1000',
    email: 'vikashkumargupta1000@gmail.com',
    alternateEmail: 'vikashkumargupta1000@gmail.com'
  },


  // 7. अतिरिक्त नोट्स (AI के संदर्भ के लिए)
  extraNotes: `
विकास की शैक्षणिक पृष्ठभूमि स्पष्ट है: Nursery–5th (Girls Primary School, Mairwa Dham, 2015) -> 6th–10th (Sant Digambar Nath Higher Secondary School, Pachrukhiya Balua, Deoria, 2021 में 84.3%) -> 3-Year Diploma in CSE (Government Polytechnic Unnao, 2024 में 70%) -> B.Tech in AIML (Sagar Institute of Technology & Management / Sagar Group of Institutions, Barabanki, AKTU — Pursuing)। विकास ने 12वीं (Intermediate) नहीं की है, बल्कि 10वीं के बाद सीधे डिप्लोमा और फिर B.Tech किया है।
डिप्लोमा के फर्स्ट ईयर के बाद उन्होंने SoftPro India से 45 दिन की Python with Django ट्रेनिंग की, और सेकंड ईयर के बाद Makartaj Private Limited से 45 दिन की ASP.NET with MVC ट्रेनिंग की जिसमें उन्हें "Best Performer Award" मिला।
संपर्क व सोशल मीडिया: LinkedIn (linkedin.com/in/vikash-kumargupta), Email (vikashkumargupta1000@gmail.com), Instagram (@_vikashkgupta), Facebook और GitHub।
  `.trim()
};