import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // HomePage translations
    "home.title": "Vision AI Investigation System",
    "home.welcome": "Welcome back",
    "home.signOut": "Sign Out",
    "home.searchCases": "Search cases...",
    "home.allStatus": "All Status",
    "home.active": "Active",
    "home.inactive": "Inactive",
    "home.newestFirst": "Newest First",
    "home.oldestFirst": "Oldest First",
    "home.newCase": "New Case",
    "home.investigationCases": "Investigation Cases",
    "home.cases": "cases",
    "home.noCasesFound": "No cases found",
    "home.noCasesYet": "No cases yet",
    "home.adjustSearch": "Try adjusting your search terms",
    "home.createFirstCase": "Create your first case to get started",
    "home.createCase": "Create Case",
    "home.deactivateCase": "Deactivate Case",
    "home.activateCase": "Activate Case",
    "home.startNewSession": "Start New Session",
    "home.error": "Error",
    "home.previous": "Previous",
    "home.next": "Next",
    "home.page": "Page",
    "home.of": "of",

    "modal.createNewCase": "Create New Case",
    "modal.caseTitle": "Case Title",
    "modal.description": "Description",
    "modal.enterTitle": "Enter case title...",
    "modal.enterDescription": "Enter case description...",
    "modal.cancel": "Cancel",
    "modal.creating": "Creating...",
    "modal.createCase": "Create Case",

    // SessionInfo translations
    "sessionInfo.title": "Session Info",
    "sessionInfo.participantName": "Participant Name",
    "sessionInfo.sessionId": "Session ID",
    "sessionInfo.duration": "Duration",
    "sessionInfo.statistics": "Statistics",
    "sessionInfo.words": "Words",
    "sessionInfo.translations": "Translations",
    "sessionInfo.avgConfidence": "Avg Confidence",
    "sessionInfo.notVerified": "Not verified yet",
    "sessionInfo.personType": "Participant Type",
    "sessionInfo.totalWords": "Total Words",
    "sessionInfo.investigatorWords": "Total Investigator Words",
    "sessionInfo.witnessWords": "Total Witness Words",
    "sessionInfo.currentConfidence": "Current Witness Confidence",

    // SessionPage translations
    "session.backToHome": "Back to Home",
    "session.session": "Session",
    "session.live": "LIVE",
    "session.investigator": "Investigator",
    "session.case": "Case",
    "session.language": "Language",
    "session.pause": "Pause",
    "session.resume": "Resume",
    "session.reset": "Reset",
    "session.endSession": "End Session",
    "session.realTime": "Real-time",
    "session.processing": "Processing",
    "session.summarization": "Summarization",

    // Identity Verification translations
    "identity.title": "Identity Verification",
    "identity.personType": "Person Type",
    "identity.witness": "Witness",
    "identity.accused": "Accused",
    "identity.victim": "Victim",
    "identity.verificationAttempts": "Verification Attempts",
    "identity.remainingAttempts": "remaining",
    "identity.maximumAttempts": "Maximum attempts reached",
    "identity.successAttempt": "Identity Verified Successfully!",
    "identity.passportWarning":
      "⚠️ Note: Passport verification is optimized for Bahraini passports only. Other nationalities may not yield optimal extraction results. For best results with other nationalities, please use CPR card verification.",
    "identity.referencePhoto": "Reference Photo",
    "identity.uploadPhoto":
      "Upload a clear photo of the person for identity verification during the investigation",
    "identity.uploadPhotoDescription": "Upload a clear photo of the person",
    "identity.uploadPhotoBtn": "Upload Person Photo",
    "identity.documentType": "Document Type",
    "identity.cpr": "CPR Card",
    "identity.passport": "Passport",
    "identity.uploadDocument": "Upload document for identity verification",
    "identity.uploadButton": "Upload",
    "identity.fileTypes": "JPG, PNG, PDF",
    "identity.uploadDocumentDescription": "JPG, PNG, PDF",
    "identity.uploadSuccess": "uploaded successfully",
    "identity.verifyButton": "Verify Identity",
    "identity.cprNumber": "CPR Number",
    "identity.startInvestigation": "Start Investigation",
    "identity.verificationSuccess": "Identity Verified Successfully",
    "identity.VerificationResults": "Verification Results",
    "identity.pleaseEnterName": "Please enter witness full name.",
    "identity.pleaseUploadPhoto": "Please upload a reference photo.",
    "identity.completeVerification": "Complete Identity Verification",
    "identity.verificationComplete":
      "Identity verification completed successfully!",
    "identity.nationality": "Nationality",
    "identity.verifyWith": "Verify with",
    "identity.optionOne": "Option 1: Accept Verification with Manual Entry",
    "identity.optionOneDescription":
      "If you believe the identity is correct despite the failed automated verification, manually enter the participant's details and provide a detailed reason for approval.",
    "identity.UploadedPicture": "Uploaded Photo",
    "identity.noPreview": "No preview available",
    "identity.comparisonSource": "Comparison Source",
    "identity.referenceLoading": "Loading reference photo",
    "identity.databaseReference": "Reference photo from database",
    "identity.documentLoading": "Loading document photo",
    "identity.similarityScore": "Similarity Score",
    "identity.confidence": "Confidence",
    "identity.status": "Status",
    "identity.verified": "VERIFIED",
    "identity.notVerified": "NOT VERIFIED",
    "identity.overrideReason": "Override Reason",
    "identity.opetionTwo": "Option 2: End This Session",
    "identity.optionTwoDescription":
      "If you cannot verify the identity or believe the verification has failed legitimately, you can end this session. All data will be reset.",
    "identity.endSession": "End Session and Start Over",
    "identity.processingManualApproval": "Processing Manual Approval...",
    "identity.acceptAndProceed": "Accept and Proceed to Investigation",
    "identity.reasonForManualOverride": "Reason for Manual Override *",
    "identity.enterReason": "Enter detailed reason for manual approval",
    "identity.overrideWarning": "Maximum verification attempts (3) reached.",
    "identity.overrideWarningDescription":
      "The automated verification has failed. Choose one of the following options to proceed:",
    "identity.enterFullName": "Enter full name as shown on document",
    "identity.enterCPR": "Enter 9-digit CPR number",
    "identity.digitsOnly": "9 digits only",
    "identity.enterNationality":
      "Enter nationality (e.g., Bahraini, Indian, etc.)",
    "identity.maxAttemptsReached": "Maximum Attempts Reached",
    "identity.retryVerification": "Retry Verification",
    "identity.attempt": "attempt",
    "identity.attempts": "attempts",
    "identity.verifyingIdentity": "Verifying Identity...",
    "identity.verificationError":
      "An error occurred during verification. Choose one of the following options to proceed:",

    // Confirmation Popup translations
    "popup.title": "End Session",
    "popup.message":
      "Are you sure you want to end this session? All verification data will be lost and you'll be redirected to the homepage. This action cannot be undone.",
    "popup.confirm": "Confirm",
    "popup.cancel": "Cancel",

    //Translation Language Names
     "lang.af-ZA": "Afrikaans",
    "lang.ar-AE": "Arabic (Gulf)",
    "lang.ar-SA": "Arabic (Modern Standard)",
    "lang.ca-ES": "Catalan",
    "lang.cs-CZ": "Czech",
    "lang.da-DK": "Danish",
    "lang.de-DE": "German",
    "lang.de-CH": "German (Swiss)",
    "lang.el-GR": "Greek",
    "lang.en-AU": "English (Australian)",
    "lang.en-GB": "English (British)",
    "lang.en-IN": "English (Indian)",
    "lang.en-NZ": "English (New Zealand)",
    "lang.en-US": "English (US)",
    "lang.en-ZA": "English (South African)",
    "lang.es-ES": "Spanish",
    "lang.es-US": "Spanish (US)",
    "lang.fa-IR": "Farsi",
    "lang.fi-FI": "Finnish",
    "lang.fr-CA": "French (Canadian)",
    "lang.fr-FR": "French",
    "lang.he-IL": "Hebrew",
    "lang.hi-IN": "Hindi",
     "lang.hr-HR": "Croatian",
    "lang.id-ID": "Indonesian",
    "lang.it-IT": "Italian",
    "lang.ja-JP": "Japanese",
    "lang.ko-KR": "Korean",
    "lang.ms-MY": "Malay",
    "lang.nl-NL": "Dutch",
    "lang.no-NO": "Norwegian Bokmål",
    "lang.pl-PL": "Polish",
    "lang.pt-BR": "Portuguese (Brazilian)",
    "lang.pt-PT": "Portuguese",
    "lang.ro-RO": "Romanian",
    "lang.ru-RU": "Russian",
    "lang.sk-SK": "Slovak",
    "lang.sr-RS": "Serbian",
    "lang.sv-SE": "Swedish",
    "lang.th-TH": "Thai",
    "lang.tl-PH": "Tagalog/Filipino",
    "lang.uk-UA": "Ukrainian",
    "lang.vi-VN": "Vietnamese",
    "lang.zh-CN": "Chinese (Simplified)",
    "lang.zh-HK": "Chinese (Cantonese)",
    "lang.zh-TW": "Chinese (Traditional)",

    // RealTimeTranslation translations
    "translation.settingsTitle": "Translation Settings",
    "translation.waiting": "Waiting for transcription...",
    "translation.waitingForSpeech":
      "Translation will start automatically when speech is detected",
    "translation.demoNote": "Real-time translation from live transcription",
    "translation.witnessInstruction":
      "Click 'Witness View' to open translation for witness",
    "translation.pdfTitle": "Investigation Transcript - Translation",
    "translation.exportPDF": "Download PDF",
    "translation.exportWord": "Download Word",
    "translation.exportMarkdown": "Markdown",
    "translation.generating": "Generating...",

    "session.witnessView": "Witness View",
    "session.messages": "messages",
    "session.clearAll": "Clear All", 

    
    // PDFExporter translations
    "pdf.downloadPdf": "Download PDF",
    "pdf.downloadWord": "Download Word",
    "pdf.downloadMarkdown": "Markdown",
    "pdf.exportAsPdf": "Export as PDF",
    "pdf.exportAsWord": "Export as Word Document",
    "pdf.exportAsMarkdown": "Export as Markdown",
    // Summarization translations
    "summarization.title": "AI-Powered Investigation Summary",
    "summarization.sessionDetails": "Session Details",
    "summarization.sessionId": "Session ID",
    "summarization.duration": "Duration",
    "summarization.personType": "Person Type",
    "summarization.status": "Status",
    "summarization.customization": "Summary Customization",
    "summarization.usingLiveTranscript": "Using live transcript",
    "summarization.characters": "characters",
    "summarization.noLiveTranscript": "No live transcript - using demo data",
    "summarization.summaryLanguage": "Summary Language",
    "summarization.summaryLength": "Summary Length",
    "summarization.english": "English",
    "summarization.arabic": "Arabic (العربية)",
    "summarization.short": "Short (100-150 words)",
    "summarization.medium": "Medium (200-300 words)",
    "summarization.long": "Long (400-500 words)",
    "summarization.extraLong": "Extra Long (600-800 words)",
    "summarization.generateButton": "Generate Summary",
    "summarization.generating": "Generating Summary...",
    "summarization.generatingMessage": "Generating AI-powered summary...",
    "summarization.analyzingMessage":
      "Analyzing session content with Amazon Bedrock Nova Lite",
    "summarization.error": "Error",
    "summarization.generatedSummary": "Generated Summary",
    "summarization.summaryMetadata": "Summary Metadata",
    "summarization.summaryId": "Summary ID",
    "summarization.caseId": "Case ID",
    "summarization.language": "Language",


    // ==================== AI ASSISTANT ====================
    // Main Generator
    "aiAssistant.title": "AI Assistant",
    "aiAssistant.startRecording": "Start recording to generate questions",
    "aiAssistant.questionsBasedOnTestimony": "Questions will be generated based on live testimony",
    "aiAssistant.noQuestionsYet": "No questions generated yet",
    "aiAssistant.clickGenerate": "Click \"Generate Questions\" above to start",
    "aiAssistant.cannotGenerate": "Cannot Generate Questions",
    "aiAssistant.tip": "Tip",
    "aiAssistant.tipStartRecording": "Start the recording to begin collecting testimony.",
    "aiAssistant.tipWaitForSpeech": "Wait for the witness to speak so the system can generate relevant questions.",
    "aiAssistant.rejectedQuestions": "Rejected Questions",
    "aiAssistant.clickToExpand": "Click to expand",

     // Generator Controls
    "aiAssistant.questions": "Questions",
    "aiAssistant.generateButton": "Generate Questions",
    "aiAssistant.generating": "Generating...",
    "aiAssistant.waitingForTranscript": "Waiting for transcript...",

    // Metrics
    "aiAssistant.confirmed": "Confirmed",
    "aiAssistant.rejected": "Rejected",
    "aiAssistant.retries": "Retries",

     // Question Card
    "aiAssistant.highPriority": "High Priority",
    "aiAssistant.highConfidence": "High Confidence",
    "aiAssistant.showReasoning": "Show Reasoning",
    "aiAssistant.copy": "Copy",
    "aiAssistant.aiReasoning": "AI Reasoning",
    "aiAssistant.source": "Source",
    "aiAssistant.showQuestion": "Show Question",

     // Question Categories
    "aiAssistant.category.clarification": "Clarification",
    "aiAssistant.category.verification": "Verification",
    "aiAssistant.category.contradiction": "Contradiction",
    "aiAssistant.category.timeline": "Timeline",
    "aiAssistant.category.motivation": "Motivation",
    
    // Question List
    "aiAssistant.confirmAll": "Confirm All",
    "aiAssistant.retryAll": "Retry All",
    "aiAssistant.retrySelected": "Retry Selected",
    
    // Attempt Navigation
    "aiAssistant.attempt": "Attempt",
    "aiAssistant.of": "of",
    "aiAssistant.previousAttempt": "Previous attempt",
    "aiAssistant.nextAttempt": "Next attempt",

    // Question Evaluation Tool
    "evaluation.title": "Question Evaluation Tool",
    "evaluation.subtitle": "Training & Quality Check",
    "evaluation.instructions": "Type your own question below and get instant AI feedback on clarity, relevance, and appropriateness. This helps improve your questioning skills without affecting the current session.",
    "evaluation.placeholder": "Example: Can you describe what happened at approximately 3:00 PM when you saw the accused?",
    "evaluation.evaluateButton": "Evaluate Question",
    "evaluation.evaluating": "Evaluating...",
    "evaluation.clear": "Clear",
    "evaluation.resultsTitle": "AI Evaluation Results",
    "evaluation.clarity": "Clarity",
    "evaluation.relevance": "Relevance",
    "evaluation.appropriate": "Appropriate",
    "evaluation.category": "Detected Category",
    "evaluation.issuesFound": "Issues Found:",
    "evaluation.suggestions": "Suggestions for Improvement:",
    "evaluation.improved": "AI Improved Version:",
    "evaluation.excellentQuestion": "Excellent question! This meets professional investigation standards.",

    //Transcript feature SECTION (Salman Khamis)

    //RealTimeView
    "session.Transcription_Translation": "Transcription & Translation",

    // TranscriptionSessionSetup translations - ADD THESE
    "setup.readyToStart": "Ready to Start",
    "setup.configureSession":
      "Configure your session settings before starting the recording.",
    "setup.languageMode": "Language Configuration Mode",
    "setup.singleLanguage": "Single Language for Entire Session",
    "setup.singleLanguageDesc":
      "Everyone speaks the same language. Best for standard investigations.",
    "setup.separateLanguages": "Separate Languages (Multilingual)",
    "setup.separateLanguagesDesc":
      "Investigator and witnesses speak different languages with translation.",
    "setup.sessionLanguage": "Session Language",
    "setup.autoDetect": "Auto Detect Multiple Languages",
    "setup.selectLanguages": "Select Languages to Detect",
    "setup.chooseLanguages": "Choose languages...",
    "setup.languagePriority":
      "Languages are prioritized in order of selection - first selected language gets highest priority",
    "setup.investigatorLanguage": "Investigator Language",
    "setup.investigatorLanguageDesc":
      "Select your language for the investigation",
    "setup.witnessLanguage": "Witness Language",
    "setup.witnessLanguageDesc": "Select the witness language",
    "setup.selectYourLanguage": "Select your language...",
    "setup.selectWitnessLanguage": "Select witness language...",
    "setup.speakerMode": "Speaker Detection Mode",
    "setup.oneOnOne": "One-on-One Interview",
    "setup.recommended": "Recommended",
    "setup.oneOnOneDesc":
      "Standard interview with two speakers (investigator + one participant). Provides the highest accuracy.",
    "setup.multipleParticipants": "Multiple Participants",
    "setup.inDevelopment": "In Development",
    "setup.multipleParticipantsDesc":
      "For group interviews or when multiple people are present.",
    "setup.mayProduceInaccurate": "May produce inaccurate results.",
    "setup.speakerLabelStandard":
      'Speakers will be labeled as "Investigator" and "Witness" for example.',
    "setup.speakerLabelMulti":
      'Speakers will be labeled as "Investigator", "Speaker 0", "Speaker 1", etc. for example.',
    "setup.startRecording": "Start Recording",
    "setup.simple": "Simple",
    "setup.advanced": "Advanced",
    //LiveTranscription
    "transcription.title": "Live Transcription",
    "transcription.initializing": "Initializing recording session...",
    "transcription.recordingAudioDetected": "Recording Active",
    "transcription.recordingNoAudio": "Recording / No Audio Input",
    "transcription.placeholder": "Transcript will appear here...",
    "transcription.copyAll": "Copy All",
  },
  ar: {
    // HomePage translations
    "home.title": "نظام التحقيق بالذكاء الاصطناعي",
    "home.welcome": "مرحباً بعودتك",
    "home.signOut": "تسجيل الخروج",
    "home.searchCases": "البحث عن القضايا...",
    "home.allStatus": "جميع القضايا",
    "home.active": "نشط",
    "home.inactive": "غير نشط",
    "home.newestFirst": "الأحدث أولاً",
    "home.oldestFirst": "الأقدم أولاً",
    "home.newCase": "قضية جديدة",
    "home.investigationCases": "قضايا التحقيق",
    "home.cases": "قضية",
    "home.noCasesFound": "لم يتم العثور على قضايا",
    "home.noCasesYet": "لا توجد قضايا بعد",
    "home.adjustSearch": "حاول تعديل مصطلحات البحث",
    "home.createFirstCase": "أنشئ قضيتك الأولى للبدء",
    "home.createCase": "إنشاء قضية",
    "home.deactivateCase": "إلغاء تفعيل القضية",
    "home.activateCase": "تفعيل القضية",
    "home.startNewSession": "بدء جلسة جديدة",
    "home.error": "خطأ",
    "home.previous": "السابق",
    "home.next": "التالي",
    "home.page": "صفحة",
    "home.of": "من",

    "modal.createNewCase": "إنشاء قضية جديدة",
    "modal.caseTitle": "عنوان القضية",
    "modal.description": "الوصف",
    "modal.enterTitle": "أدخل عنوان القضية...",
    "modal.enterDescription": "أدخل وصف القضية...",
    "modal.cancel": "إلغاء",
    "modal.creating": "جارٍ الإنشاء...",
    "modal.createCase": "إنشاء قضية",

    // SessionPage translations
    "session.backToHome": "العودة للصفحة الرئيسية",
    "session.session": "الجلسة",
    "session.live": "مباشر",
    "session.investigator": " المحقق",
    "session.case": "القضية",
    "session.language": "لغة",
    "session.pause": "إيقاف مؤقت",
    "session.resume": "استئناف",
    "session.reset": "إعادة النص",

    "session.endSession": "إنهاء الجلسة",
    "session.realTime": "ترجمة الجلسة المرئية",
    "session.processing": "المعالجة",
    "session.summarization": "الملخص",

    // SessionInfo translations
    "sessionInfo.title": "معلومات الجلسة",
    "sessionInfo.participantName": "الاسم ",
    "sessionInfo.sessionId": "رقم الجلسة",
    "sessionInfo.duration": "المدة",
    "sessionInfo.statistics": "الإحصائيات",
    "sessionInfo.words": "الكلمات",
    "sessionInfo.translations": "الترجمات",
    "sessionInfo.avgConfidence": "متوسط ثقة",

    "sessionInfo.notVerified": "لم يتم التحقق بعد",
    "sessionInfo.personType": "نوع المشارك",
    "sessionInfo.totalWords": "إجمالي الكلمات",
    "sessionInfo.investigatorWords": "إجمالي كلمات المحقق",
    "sessionInfo.witnessWords": "إجمالي كلمات المشارك",
    "sessionInfo.currentConfidence": "ثقة المشارك الحالية",

    // Identity Verification translations
    "identity.title": "التحقق من الهوية",
    "identity.personType": "نوع الشخص",
    "identity.witness": "المشارك",
    "identity.accused": "متهم",
    "identity.nationality": "الجنسية",
    "identity.verificationAttempts": "محاولات التحقق",
    "identity.remainingAttempts": "محاولة متبقية",
    "identity.verifyWith": "تحقق باستخدام",
    "identity.maximumAttempts": "تم الوصول إلى الحد الأقصى للمحاولات",
    "identity.successAttempt": "تم التحقق من الهوية بنجاح!",
    "identity.similarityScore": "نسبة التطابق",
    "identity.confidence": "الاحتمالية",
    "identity.victim": "الضحية",
    "identity.passportWarning":
      "⚠️ ملاحظة: التحقق من جواز السفر محسّن لجوازات السفر البحرينية فقط. قد لا تحقق الجنسيات الأخرى نتائج استخراج مثالية. للحصول على أفضل النتائج مع الجنسيات الأخرى، يرجى استخدام التحقق من بطاقة الهوية.",
    "identity.referencePhoto": "الصورة المرجعية",
    "identity.uploadPhoto": "قم بتحميل صورة واضحة للتعرف على الوجه",
    "identity.uploadPhotoDescription": "ارفق صورة واضحة",
    "identity.uploadPhotoBtn": "ارفق الصورة",
    "identity.documentType": "نوع الوثيقة",
    "identity.cpr": "بطاقة الهوية",
    "identity.cprNumber": "الرقم الشخصي",
    "identity.passport": "جواز السفر",
    "identity.uploadDocument": "قم بتحميل الوثيقة للتحقق من الهوية",
    "identity.uploadDocumentDescription": "ارفق",
    "identity.uploadButton": "تحميل",
    "identity.fileTypes": "JPG، PNG، PDF",
    "identity.uploadSuccess": "تم التحميل بنجاح",
    "identity.verifyButton": "التحقق من الهوية",
    "identity.startInvestigation": "بدء التحقيق",
    "identity.verificationSuccess": "تم التحقق من الهوية بنجاح",
    "identity.pleaseEnterName": "يرجى إدخال الاسم الكامل.",
    "identity.pleaseUploadPhoto": "يرجى تحميل صورة مرجعية.",
    "identity.completeVerification": "أكمل التحقق من الهوية",
    "identity.verificationComplete": "تم إكمال التحقق من الهوية بنجاح!",
    "identity.optionOne": "الخيار الأول: قبول التحقق مع الإدخال اليدوي",
    "identity.optionOneDescription":
      "إذا كنت تعتقد أن الهوية صحيحة على الرغم من فشل التحقق الآلي، ادخل المعلومات يدويًا وقدم سببًا مفصلاً للموافقة",
    "identity.VerificationResults": "نتيجة التحقق",
    "identity.UploadedPicture": "الصورة المرفقة",
    "identity.noPreview": "لا توجد معاينة متاحة",
    "identity.comparisonSource": "مصدر المقارنة",
    "identity.referenceLoading": "جارٍ تحميل الصورة المرجعية",
    "identity.databaseReference": "الصورة المرجعية من قاعدة البيانات",
    "identity.documentLoading": "جارٍ تحميل صورة المستند",
    "identity.status": "الحالة",
    "identity.verified": "تم التحقق منه",
    "identity.notVerified": "لم يتم التحقق منه",
    "identity.overrideReason": "سبب التحقق اليدوي",
    // Add these to the existing "identity" section:
    "identity.opetionTwo": "الخيار الثاني: إنهاء هذه الجلسة",
    "identity.optionTwoDescription":
      "إذا لم تتمكن من التحقق من الهوية أو تعتقد أن التحقق قد فشل بشكل مشروع، يمكنك إنهاء هذه الجلسة. سيتم إعادة تعيين جميع البيانات.",
    "identity.endSession": "إنهاء الجلسة والبدء من جديد",
    "identity.processingManualApproval": "جارٍ معالجة الموافقة اليدوية...",
    "identity.acceptAndProceed": "قبول والمتابعة إلى التحقيق",
    "identity.reasonForManualOverride": "سبب التحقق اليدوي *",
    "identity.enterReason": "أدخل سببًا مفصلاً للموافقة اليدوية",
    "identity.overrideWarning":
      "تم الوصول إلى الحد الأقصى لمحاولات التحقق (3).",
    "identity.overrideWarningDescription":
      "فشل التحقق الآلي. اختر أحد الخيارات التالية للمتابعة:",
    "identity.enterFullName": "أدخل الاسم الكامل كما هو موضح في الوثيقة",
    "identity.enterCPR": "أدخل الرقم الشخصي المكون من 9 أرقام",
    "identity.digitsOnly": "9 أرقام فقط",
    "identity.enterNationality": "أدخل الجنسية (مثل بحريني، هندي، إلخ)",
    "identity.maxAttemptsReached": "تم الوصول إلى الحد الأقصى للمحاولات",
    "identity.retryVerification": "إعادة محاولة التحقق",
    "identity.attempt": "محاولة",
    "identity.attempts": "محاولات",
    "identity.verifyingIdentity": "جارٍ التحقق من الهوية...",
    "identity.verificationError":
      "حدث خطأ أثناء التحقق. اختر أحد الخيارات التالية للمتابعة:",
    // Confirmation Popup translations
    "popup.title": "إنهاء الجلسة",
    "popup.message":
      "هل أنت متأكد من أنك تريد إنهاء هذه الجلسة؟ سيتم فقدان جميع بيانات التحقق وسيتم إعادة توجيهك إلى الصفحة الرئيسية. لا يمكن التراجع عن هذا الإجراء.",
    "popup.confirm": "تأكيد",
    "popup.cancel": "إلغاء",

    //Translation Language Names
    "lang.af-ZA": "الأفريكانية",
    "lang.ar-AE": "العربية (الخليجية)",
    "lang.ar-SA": "العربية (الفصحى)",
    "lang.ca-ES": "الكتالانية",
    "lang.cs-CZ": "التشيكية",
    "lang.da-DK": "الدنماركية",
    "lang.de-DE": "الألمانية",
    "lang.de-CH": "الألمانية (السويسرية)",
    "lang.el-GR": "اليونانية",
    "lang.en-AU": "الإنجليزية (أسترالية)",
    "lang.en-GB": "الإنجليزية (بريطانية)",
    "lang.en-IN": "الإنجليزية (هندية)",
    "lang.en-NZ": "الإنجليزية (نيوزيلندية)",
    "lang.en-US": "الإنجليزية (أمريكية)",
    "lang.en-ZA": "الإنجليزية (جنوب أفريقية)",
    "lang.es-ES": "الإسبانية",
    "lang.es-US": "الإسبانية (أمريكية)",
    "lang.fa-IR": "الفارسية",
    "lang.fi-FI": "الفنلندية",
    "lang.fr-CA": "الفرنسية (كندية)",
    "lang.fr-FR": "الفرنسية",
    "lang.he-IL": "العبرية",
    "lang.hi-IN": "الهندية",
    "lang.hr-HR": "الكرواتية",
    "lang.id-ID": "الإندونيسية",
    "lang.it-IT": "الإيطالية",
    "lang.ja-JP": "اليابانية",
    "lang.ko-KR": "الكورية",
    "lang.ms-MY": "الملايو",
    "lang.nl-NL": "الهولندية",
    "lang.no-NO": "النرويجية",
    "lang.pl-PL": "البولندية",
    "lang.pt-BR": "البرتغالية (برازيلية)",
    "lang.pt-PT": "البرتغالية",
    "lang.ro-RO": "الرومانية",
    "lang.ru-RU": "الروسية",
    "lang.sk-SK": "السلوفاكية",
    "lang.sr-RS": "الصربية",
    "lang.sv-SE": "السويدية",
    "lang.th-TH": "التايلاندية",
    "lang.tl-PH": "التاغالوغية/الفلبينية",
     "lang.uk-UA": "الأوكرانية",
    "lang.vi-VN": "الفيتنامية",
    "lang.zh-CN": "الصينية (المبسطة)",
    "lang.zh-HK": "الصينية (الكانتونية)",
    "lang.zh-TW": "الصينية (التقليدية)",

    // RealTimeTranslation translations
    "translation.settingsTitle": "إعدادات الترجمة",
    "translation.waiting": "بانتظار الترجمة...",
    "translation.waitingForSpeech": "ستبدأ الترجمة تلقائيًا عند التحدث",
    "translation.demoNote": "ترجمة فورية من النص المباشر",
    "translation.witnessInstruction":
      "انقر على 'شاشة المشارك' لفتح الترجمة للمشارك",
    "translation.pdfTitle": "نسخة التحقيق - الترجمة",
    "translation.exportPDF": "PDF تحميل",
    "translation.exportWord": "Word تحميل",
    "translation.exportMarkdown": "Markdown تحميل",
    "translation.generating": "جارٍ الترجمة...",

    "session.witnessView": "شاشة المشارك",
    "session.messages": "رسائل",
    "session.clearAll": "مسح الكل",

    // PDFExporter translations
    "pdf.downloadPdf": "PDF تحميل",
    "pdf.downloadWord": "Word تحميل",
    "pdf.downloadMarkdown": "Markdown تحميل",
    "pdf.exportAsPdf": "تصدير كملف PDF",
    "pdf.exportAsWord": "تصدير كملف Word",
    "pdf.exportAsMarkdown": "تصدير كملف Markdown",
    // Summarization translations
    "summarization.title": "ملخص التحقيق بالذكاء الاصطناعي",
    "summarization.sessionDetails": "تفاصيل الجلسة",
    "summarization.sessionId": "رقم الجلسة",
    "summarization.duration": "المدة",
    "summarization.personType": "نوع الشخص",
    "summarization.status": "الحالة",
    "summarization.customization": "تخصيص الملخص",
    "summarization.usingLiveTranscript": "استخدام النص المباشر",
    "summarization.characters": "حرف",
    "summarization.noLiveTranscript":
      "لا يوجد نص مباشر - استخدام البيانات التجريبية",
    "summarization.summaryLanguage": "لغة الملخص",
    "summarization.summaryLength": "طول الملخص",
    "summarization.english": "الإنجليزية",
    "summarization.arabic": "العربية",
    "summarization.short": "قصير (100-150 كلمة)",
    "summarization.medium": "متوسط (200-300 كلمة)",
    "summarization.long": "طويل (400-500 كلمة)",
    "summarization.extraLong": "طويل جداً (600-800 كلمة)",
    "summarization.generateButton": "إنشاء الملخص",
    "summarization.generating": "جارٍ إنشاء الملخص...",
    "summarization.generatingMessage": "جارٍ إنشاء ملخص بالذكاء الاصطناعي...",
    "summarization.analyzingMessage":
      "تحليل محتوى الجلسة باستخدام Amazon Bedrock Nova Lite",
    "summarization.error": "خطأ",
    "summarization.generatedSummary": "الملخص المُنشأ",
    "summarization.summaryMetadata": "بيانات الملخص",
    "summarization.summaryId": "رقم الملخص",
    "summarization.caseId": "رقم القضية",
    "summarization.language": "اللغة",

     // ==================== AI ASSISTANT ====================
     // Main Generator
    "aiAssistant.title": "المساعد الذكي",
    "aiAssistant.startRecording": "ابدأ التسجيل لتوليد الأسئلة",
    "aiAssistant.questionsBasedOnTestimony": "سيتم توليد الأسئلة بناءً على الشهادة المباشرة",
    "aiAssistant.noQuestionsYet": "لم يتم توليد أسئلة بعد",
    "aiAssistant.clickGenerate": "انقر على \"توليد الأسئلة\" أعلاه للبدء",
    "aiAssistant.cannotGenerate": "لا يمكن توليد الأسئلة",
    "aiAssistant.tip": "نصيحة",
    "aiAssistant.tipStartRecording": "ابدأ التسجيل لبدء جمع الشهادة.",
    "aiAssistant.tipWaitForSpeech": "انتظر حتى يتحدث الشاهد حتى يتمكن النظام من توليد أسئلة ذات صلة.",
    "aiAssistant.rejectedQuestions": "الأسئلة المرفوضة",
    "aiAssistant.clickToExpand": "انقر للتوسيع",
    
    // Generator Controls
    "aiAssistant.questions": "أسئلة",
    "aiAssistant.generateButton": "توليد الأسئلة",
    "aiAssistant.generating": "جارٍ التوليد...",
    "aiAssistant.waitingForTranscript": "في انتظار النص...",
    
    // Metrics
    "aiAssistant.confirmed": "مؤكد",
    "aiAssistant.rejected": "مرفوض",
    "aiAssistant.retries": "إعادة المحاولة",
    
    // Question Card
    "aiAssistant.highPriority": "أولوية عالية",
    "aiAssistant.highConfidence": "ثقة عالية",
    "aiAssistant.showReasoning": "إظهار السبب",
    "aiAssistant.copy": "نسخ",
    "aiAssistant.aiReasoning": "تفسير الذكاء الاصطناعي",
    "aiAssistant.source": "المصدر",
    "aiAssistant.showQuestion": "إظهار السؤال",
    
    // Question Categories
    "aiAssistant.category.clarification": "توضيح",
    "aiAssistant.category.verification": "تحقق",
    "aiAssistant.category.contradiction": "تناقض",
    "aiAssistant.category.timeline": "الخط الزمني",
    "aiAssistant.category.motivation": "الدافع",
    
    // Question List
    "aiAssistant.confirmAll": "تأكيد الكل",
    "aiAssistant.retryAll": "إعادة محاولة الكل",
    "aiAssistant.retrySelected": "إعادة محاولة المحدد",

     // Attempt Navigation
    "aiAssistant.attempt": "محاولة",
    "aiAssistant.of": "من",
    "aiAssistant.previousAttempt": "المحاولة السابقة",
    "aiAssistant.nextAttempt": "المحاولة التالية",
    
    // Question Evaluation Tool
    "evaluation.title": "أداة تقييم الأسئلة",
    "evaluation.subtitle": "التدريب وفحص الجودة",
    "evaluation.instructions": "اكتب سؤالك أدناه واحصل على تقييم فوري من الذكاء الاصطناعي حول الوضوح والصلة والملاءمة. يساعد هذا على تحسين مهارات طرح الأسئلة دون التأثير على الجلسة الحالية.",
    "evaluation.placeholder": "مثال: هل يمكنك وصف ما حدث في حوالي الساعة 3:00 مساءً عندما رأيت المتهم؟",
    "evaluation.evaluateButton": "تقييم السؤال",
    "evaluation.evaluating": "جارٍ التقييم...",
    "evaluation.clear": "مسح",
    "evaluation.resultsTitle": "نتائج تقييم الذكاء الاصطناعي",
    "evaluation.clarity": "الوضوح",
    "evaluation.relevance": "الصلة",
    "evaluation.appropriate": "المناسبة",
    "evaluation.category": "الفئة المكتشفة",
    "evaluation.issuesFound": "المشاكل المكتشفة:",
    "evaluation.suggestions": "اقتراحات للتحسين:",
    "evaluation.improved": "النسخة المحسنة:",
    "evaluation.excellentQuestion": "سؤال ممتاز! يستوفي هذا معايير التحقيق المهنية.",

    //Transcript feature SECTION (Salman Khamis)

    //Real time
    "session.Transcription_Translation": "التفريغ النص والترجمة",

    // TranscriptionSessionSetup translations - ADD THESE
    "setup.readyToStart": "جاهز للبدء",
    "setup.configureSession": "قم بتكوين إعدادات الجلسة قبل بدء التسجيل.",
    "setup.languageMode": "وضع تكوين اللغة",
    "setup.singleLanguage": "لغة واحدة للجلسة بأكملها",
    "setup.singleLanguageDesc":
      "الجميع يتحدث نفس اللغة. الأفضل للتحقيقات القياسية.",
    "setup.separateLanguages": "لغات منفصلة (متعدد اللغات)",
    "setup.separateLanguagesDesc":
      "المحقق والشهود يتحدثون لغات مختلفة مع الترجمة.",
    "setup.sessionLanguage": "لغة الجلسة",
    "setup.autoDetect": "الكشف التلقائي عن اللغات المتعددة",
    "setup.selectLanguages": "اختر اللغات المراد اكتشافها",
    "setup.chooseLanguages": "اختر اللغات...",
    "setup.languagePriority":
      "يتم ترتيب اللغات حسب أولوية الاختيار - اللغة الأولى المختارة لها الأولوية القصوى",
    "setup.investigatorLanguage": "لغة المحقق",
    "setup.investigatorLanguageDesc": "اختر لغتك للتحقيق",
    "setup.witnessLanguage": "لغة المشارك",
    "setup.witnessLanguageDesc": "اختر لغة المشارك",
    "setup.selectYourLanguage": "اختر لغتك...",
    "setup.selectWitnessLanguage": "اختر لغة المشارك...",
    "setup.speakerMode": "وضع اكتشاف المتحدث",
    "setup.oneOnOne": "مقابلة فردية",
    "setup.recommended": "موصى به بشدة",
    "setup.oneOnOneDesc":
      "مقابلة فردية بين شخصين فقط (محقق ومشارك واحد)، وتوفر أعلى دقة في التفريغ النصي.",
    "setup.multipleParticipants": "مشاركون متعددون",
    "setup.inDevelopment": "قيد التطوير",
    "setup.multipleParticipantsDesc":
      "للمقابلات الجماعية أو عند وجود عدة أشخاص.",
    "setup.mayProduceInaccurate": "قد ينتج نتائج غير دقيقة.",
    "setup.speakerLabelStandard":
      'سيتم تصنيف المتحدثين كـ "محقق" و "المشارك" على سبيل المثال.',
    "setup.speakerLabelMulti":
      'سيتم تصنيف المتحدثين كـ "محقق" و "متحدث 0" و "متحدث 1" وما إلى ذلك على سبيل المثال.',
    "setup.startRecording": "بدء التسجيل",
    "setup.simple": "بسيط",
    "setup.advanced": "متقدم",

    //LiveTranscription
    "transcription.title": "التفريغ النص المباشر",
    "transcription.initializing": "جارٍ تهيئة جلسة التسجيل...",
    "transcription.recordingAudioDetected": "جاري التسجيل",
    "transcription.recordingNoAudio": "جاري التسجيل / لا يوجد إدخال صوتي",
    "transcription.placeholder": "سيظهر النص هنا...",
    "transcription.copyAll": "نسخ الكل",
  },
};


const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>("en");

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ar" : "en"));
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
