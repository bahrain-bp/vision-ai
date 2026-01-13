import React, { useState, useContext } from 'react';
import { FileText } from 'lucide-react';
import { TranscriptionContext } from '../../../context/TranscriptionContext';
import { useCaseContext } from '../../../hooks/useCaseContext';
import { useLanguage } from '../../../context/LanguageContext';
import SessionDetailsCard from './SessionDetailsCard';
import CustomizationPanel from './CustomizationPanel';
import LoadingState from './LoadingState';
import ErrorDisplay from './ErrorDisplay';
import SummaryDisplay from './SummaryDisplay';
import './SummarizationReport.css';

/*
 * SummarizationReport (Main Container)
 * 
 * Purpose: Orchestrate AI-powered investigation summary generation
 * 
 * Features: Integrates all summarization sub-components, manages state,
 * handles API communication with AWS Bedrock Nova Lite, coordinates
 * real-time transcript data from Transcription context
 * 
 * Integration: Main entry point for Summarization feature, connects to
 * Identity Verification (person type), Transcription (transcript data),
 * and Language contexts for bilingual support
 * 
 * DEMO MODE: Currently using mock data to avoid AWS throttling errors
 */

interface SessionData {
  sessionId: string;
  participant: string;
  language: string;
  duration: string;
  status: string;
}

interface SummarizationReportProps {
  sessionData: SessionData;
}

const SummarizationReport: React.FC<SummarizationReportProps> = ({
  sessionData
}) => {
  // State Management
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>('en');
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long' | 'extra-long'>('medium');

  // API Configuration (CURRENTLY NOT USED - MOCK DATA MODE)
  // const API_URL = 'https://yphcka81y6.execute-api.us-east-1.amazonaws.com/prod/summarize';

  // Context Integration
  const transcriptionContext = useContext(TranscriptionContext);
  const realTranscript = transcriptionContext?.getFullTranscript || '';
  
  const { currentPersonType, currentCase, currentSession } = useCaseContext();
  const participantType = currentPersonType || 'Not set';
  
  const { t } = useLanguage();

  // Generate Summary Handler - USING MOCK DATA FOR DEMO
  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    // Mock data for different summary lengths and languages
    const mockSummaries = {
      en: {
        short: "CASE SUMMARY:\nPublic disturbance investigation at Ritz-Carlton Hotel, Seef District, May 24, 2024.\n\nACCUSED:\nSuliman Abdulmohsen Suliman (Saudi national, ID: 1011710782), age 42, lawyer.\n\nINCIDENT:\nRefused restaurant payment, insulted police officers (Corporals Ali Anwar Mohammed and Shazad Anjum), exhibited intoxicated behavior. Uncooperative with authorities, made false assault claims later retracted.\n\nEVIDENCE:\nWitness testimony from restaurant security manager Abdul Aziz Maher Ahmed, police reports, positive blood alcohol test, photographic documentation, accused's confession.\n\nCHARGES:\nInsulting public officials during duty performance, public intoxication.\n\nOUTCOME:\nSentenced to 20 days imprisonment with immediate execution (June 12, 2024). Case closed, sentence executed.\n\nSTATUS:\nFinal - investigation complete, all procedures compliant with Bahraini law.",
        
        medium: "CASE OVERVIEW:\nInvestigation of public disturbance at Trader Vic's restaurant, Ritz-Carlton Hotel, Seef District, occurring after midnight on May 24, 2024. Accused Suliman Abdulmohsen Suliman (Saudi national, age 42) refused payment and engaged in disorderly conduct with law enforcement.\n\nINCIDENT DETAILS:\nThe accused arrived at the restaurant May 23, 2024 at 10:00 PM and consumed alcoholic beverages. At 12:15 AM, he refused to pay the bill and created disturbance with shouting and disruptive behavior. Restaurant security manager Abdul Aziz Maher Ahmed contacted Capital Police Station.\n\nPOLICE RESPONSE:\nCorporals Ali Anwar Mohammed and Shazad Anjum responded to the scene. The accused was highly uncooperative, refused to show identification, claimed to be an \"international lawyer,\" and demanded officers call police despite their identification. He insulted both officers during their official duty performance. Officers placed him in handcuffs and transported him to the station.\n\nMEDICAL EVIDENCE:\nAt Al Qalaa Clinic, blood alcohol testing confirmed intoxication. During transport, the accused self-inflicted minor facial injury with handcuffs, witnessed by both officers. He initially made false assault accusations against officers before retracting and apologizing once sober.\n\nLEGAL PROCEEDINGS:\nCharged with insulting public officials (Articles 75/5, 92/1-2, 107) and public intoxication (Article 306/1). The accused provided full confession during prosecution interrogation. Minor Criminal Court sentenced him to 20 days imprisonment with immediate execution on June 12, 2024.\n\nOUTCOME:\nSentence executed. Case demonstrates appropriate law enforcement response, proper evidence collection, and due process through Bahrain's justice system.",
        
        long: "COMPREHENSIVE CASE REPORT\n\nCase Number: 94346/2024\nDate: May 24, 2024, 00:15 AM\nLocation: Trader Vic's Restaurant, Ritz-Carlton Hotel, Seef District\nInvestigating Authority: Capital Prosecution, Public Prosecution Office\n\nPARTIES INVOLVED:\n\nAccused: Suliman Abdulmohsen Suliman\n- National ID: 1011710782\n- Nationality: Saudi Arabian\n- Age: 42 years, Occupation: Lawyer\n- Marital Status: Married with four children\n\nComplainants:\n1. Corporal Ali Anwar Mohammed (ID: 222077482) - Bahraini Police\n2. Head Corporal Shazad Anjum (ID: 222084284) - Bahraini Police\n\nWitness: Abdul Aziz Maher Ahmed (ID: 222094635) - Security Manager, Trader Vic's Restaurant\n\nINCIDENT TIMELINE:\n\n[May 23, 2024 - 22:00] The accused arrived at Trader Vic's restaurant and began consuming alcoholic beverages over several hours.\n\n[May 24, 2024 - 00:15] Upon receiving the bill, the accused refused full payment. A dispute arose with restaurant management. The accused became increasingly agitated, creating disturbance with loud shouting and disruptive behavior affecting other patrons.\n\n[00:15] Security Manager Abdul Aziz Maher Ahmed contacted Capital Police Station reporting refusal to pay and disorderly conduct. Patrol unit Manama 135 was dispatched.\n\n[00:20] Corporals Ali Anwar Mohammed and Shazad Anjum arrived. They observed the accused creating significant disturbance in the parking area.\n\nPOLICE INTERACTION:\nWhen officers approached, the accused displayed highly uncooperative behavior. He refused to show identification, failed to recognize officers' authority, repeatedly claimed to be an \"international lawyer,\" and demanded officers \"call the police\" despite their clear identification. He engaged in loud, confrontational behavior and insulted both officers during their lawful duty performance.\n\nThe accused voluntarily entered the patrol vehicle. Officers placed standard handcuffs on his wrists. During transport, the accused struck himself with the handcuffs on his right cheek, causing visible redness. This was directly witnessed by both officers present.\n\nPOST-ARREST PROCEDURES:\nAt the police station, the accused cried loudly and made false accusations claiming officers assaulted him. He initially accused Corporal Ali Anwar Mohammed, then changed his story to implicate another officer (Corporal Abdul Ghani Abdul Ghaffar) who was not present at the scene.\n\nMedical examination at Al Qalaa Clinic confirmed intoxication through blood alcohol testing. The accused admitted to consuming approximately 24 cans of beer and multiple tequila servings that day.\n\nOnce sober, the accused retracted all false accusations and provided a written apology: \"I was in an abnormal state and accidentally hit my face with the handcuffs. I apologize to the police for my poor treatment of them.\"\n\nLEGAL CHARGES:\n1. Insulting public officials during duty performance (Articles 75/5, 92/1-2, 107, Penal Code)\n2. Public intoxication (Article 306/1, Penal Code)\n\nCOURT PROCEEDINGS:\nThe accused provided full confession during prosecution interrogation and requested expedited trial. He expressed remorse, citing family responsibilities including four children and a disabled mother.\n\nJUDGMENT:\nMinor Criminal Court sentenced the accused to 20 days imprisonment with immediate execution on June 12, 2024. Sentence was carried out. Case closed.\n\nCONCLUSION:\nCase demonstrates appropriate law enforcement response to public disturbance, proper evidence collection procedures, protection of official authority, and balanced judicial consideration. All procedures complied with Bahraini law.",
        
        'extra-long': "DETAILED INVESTIGATION REPORT: PUBLIC DISTURBANCE AND INSULT TO OFFICIALS\n\nCase Number: 94346/2024\nInvestigating Authority: Capital Prosecution, Public Prosecution Office\nDate of Incident: Friday, May 24, 2024, 00:15 AM\nLocation: Trader Vic's Restaurant, Ritz-Carlton Hotel, Seef District, Block 428\nFinal Judgment: June 12, 2024\n\nEXECUTIVE SUMMARY:\nThis investigation addresses a criminal case involving public disturbance, refusal to pay for services, insulting public officials during duty performance, and public intoxication. The incident occurred at Trader Vic's restaurant within the Ritz-Carlton Hotel premises. The investigation demonstrates systematic non-cooperation with lawful authority, false accusations against law enforcement officers, and confirmed intoxication in a public setting. The case proceeded through investigation, prosecution, and court proceedings, resulting in a 20-day imprisonment sentence.\n\nPARTIES IDENTIFICATION:\n\nACCUSED:\n- Full Name: Suliman Abdulmohsen Suliman\n- National ID: 1011710782\n- Nationality: Saudi Arabian\n- Age: 42 years\n- Occupation: Lawyer (claims \"international lawyer\")\n- Marital Status: Married\n- Dependents: Wife, two daughters, two sons, disabled mother\n- Residence: Dammam, Saudi Arabia\n- Entry to Bahrain: May 23, 2024, 2:00 PM via King Fahd Causeway\n- Purpose of Visit: Personal errands\n\nCOMPLAINANTS:\n1. Corporal Ali Anwar Mohammed (ID: 222077482) - Bahraini Police, Capital Police Directorate\n2. Head Corporal Shazad Anjum (ID: 222084284) - Pakistani national, Bahraini Police\n\nWITNESS:\n- Abdul Aziz Maher Ahmed (ID: 222094635) - Security Manager, Trader Vic's Restaurant, Age 34, Bahraini\n\nDETAILED INCIDENT TIMELINE:\n\n[Thursday, May 23, 2024 - 22:00 Hours]\nThe accused arrived at Trader Vic's restaurant and began consuming alcoholic beverages. According to his later testimony, he consumed approximately 24 cans of beer and multiple tequila servings throughout the evening.\n\n[Friday, May 24, 2024 - 00:00 Hours]\nRestaurant staff presented the bill. The accused initially paid approximately 200 Bahraini Dinars but refused to pay additional outstanding amounts, claiming dispute over charges.\n\n[00:10 Hours]\nThe payment dispute escalated. The accused's behavior became increasingly disruptive with raised voice, aggressive manner, and disturbance affecting other restaurant patrons. Security Manager Abdul Aziz Maher Ahmed attempted resolution without success.\n\n[00:12 Hours]\nSecurity Manager contacted Capital Police Emergency Line (Al-Maarid Police Station) reporting refusal to pay and disorderly conduct. Call logged as Report #2024/2140. Patrol unit Manama 135 assigned.\n\n[00:15 Hours]\nCorporals Ali Anwar Mohammed and Shazad Anjum arrived at the parking area. They immediately observed the accused in agitated state with loud shouting and disruptive behavior.\n\nPOLICE INTERACTION AND ARREST:\n\nInitial Contact:\nWhen officers approached, the accused displayed extreme non-cooperation. He refused to show identification documents, failed to recognize officers' authority despite their uniforms and clear identification, repeatedly claimed to be an \"international lawyer,\" and demanded officers \"call the police\" while officers informed him multiple times they were police.\n\nThe accused engaged in loud, confrontational behavior and insulted both officers with statements and gestures during their lawful performance of official duties. This constituted the primary criminal offense of insulting public officials.\n\nTransport to Station:\nThe accused voluntarily entered the patrol vehicle. Officers placed standard procedural handcuffs on his wrists. During transport, the accused struck himself with the handcuffs on his right cheek, causing visible redness. Both officers directly witnessed this self-inflicted action.\n\nFALSE ACCUSATIONS:\nUpon arrival at the police station, the accused cried loudly and made false accusations claiming Corporal Ali Anwar Mohammed assaulted him. He later changed his accusation to implicate Corporal Abdul Ghani Abdul Ghaffar, who was not present at the scene and did not participate in the arrest.\n\nMEDICAL EVIDENCE:\nThe accused was transported to Al Qalaa Clinic for examination. Blood alcohol testing conclusively confirmed intoxication. During examination, the accused smeared blood from the finger prick test onto his trousers and falsely claimed leg injury while pointing to the blood smear. He refused actual medical examination of the alleged injury. The only visible injury was the self-inflicted redness on his right cheek.\n\nWITNESS TESTIMONY:\nSecurity Manager Abdul Aziz Maher Ahmed provided independent witness testimony confirming: the accused ordered alcoholic beverages, refused payment, created chaos with shouting, was uncooperative with police in a provocative manner, and voluntarily entered the patrol vehicle. The witness explicitly stated there was no physical confrontation or assault between the accused and police officers.\n\nACCUSED'S STATEMENTS:\n\nInitial False Accusations (while intoxicated):\nMade false claims of police assault, changed accusations between different officers.\n\nRevised Statement (after sobering):\n\"I was in an abnormal state and accidentally hit my face with the handcuffs on the right side, which caused redness on my right cheek. I apologize to the police for my poor treatment of them at a time when I was in an abnormal state and moment of agitation.\"\n\nFormal Prosecution Interrogation:\nThe accused provided full confession acknowledging all charges. He admitted consuming approximately 24 cans of beer and many tequilas, confirmed he was intoxicated and arguing loudly with police, acknowledged raising his voice and shouting, admitted the phone/handcuff incident was accidental, and confirmed police did not assault him. He expressed deep remorse and requested expedited trial, citing family responsibilities including four children and disabled mother.\n\nLEGAL CHARGES:\n\n1. Insulting Public Officials (Articles 75/5, 92/1-2, 107 of Penal Code)\n   - Insulted Corporals Ali Anwar Mohammed and Shazad Anjum\n   - Insults occurred during and because of official duty performance\n   - Comprised verbal statements and provocative gestures\n\n2. Public Intoxication (Articles 222/1, 306/1 of Penal Code)\n   - Found in state of obvious intoxication in public place\n   - Medically confirmed through blood alcohol testing\n\nCOURT PROCEEDINGS:\n\nPresentation: Capital Prosecution presented complete evidence including police reports, witness testimony, medical evidence, accused's confession, and documentation of false accusations with subsequent retraction.\n\nDefense: The accused acknowledged all charges and requested mercy, stating family circumstances and expressing genuine remorse.\n\nJUDGMENT:\nDate: June 12, 2024\nCourt: Minor Criminal Court\nPresence: In attendance (حضورياً)\n\nSentence: Twenty (20) days imprisonment with immediate execution for all charges due to their connection (joinder of offenses).\n\nStatus: Sentence executed. Case closed. Investigation complete August 11, 2024.\n\nFINDINGS:\n\n1. The accused committed public disturbance and disorder at commercial establishment\n2. Insulted police officers during lawful duty through verbal and non-verbal means\n3. Confirmed intoxication in public place through medical testing\n4. Initially made false accusations before retracting and apologizing\n5. All witnesses corroborated no police misconduct occurred\n6. Self-inflicted injury witnessed by multiple officers\n7. Full confession and remorse during prosecution\n8. Sentence carried out per Bahraini Penal Code\n\nCONCLUSION:\nThis case demonstrates appropriate law enforcement response to public disturbance, proper evidence collection, and due process through the justice system. The 20-day sentence reflects the seriousness of insulting officials while considering the non-violent nature and mitigating factors. All procedures complied with Bahraini law."
      },
      ar: {
        short: "ملخص القضية:\nتحقيق في إزعاج عام بفندق الريتز كارلتون، منطقة السيف، 24 مايو 2024.\n\nالمتهم:\nسليمان عبدالمحسن سليمان (سعودي، رقم الهوية: 1011710782)، العمر 42 سنة، محامٍ.\n\nالحادثة:\nرفض دفع فاتورة المطعم، أهان ضباط الشرطة (العريفان علي أنور محمد وشهزاد أنجوم)، سلوك في حالة سُكر. غير متعاون مع السلطات، ادعاءات اعتداء كاذبة تم التراجع عنها لاحقاً.\n\nالأدلة:\nشهادة شاهد من مدير أمن المطعم عبدالعزيز ماهر أحمد، تقارير الشرطة، فحص دم إيجابي للكحول، توثيق فوتوغرافي، اعتراف المتهم.\n\nالتهم:\nإهانة موظفين عموميين أثناء أداء الواجب، سُكر علني.\n\nالنتيجة:\nالحكم بالسجن 20 يوماً مع النفاذ الفوري (12 يونيو 2024). أُغلقت القضية، نُفذ الحكم.\n\nالحالة:\nنهائي - اكتمل التحقيق، جميع الإجراءات متوافقة مع القانون البحريني.",
        
        medium: "نظرة عامة على القضية:\nتحقيق في إزعاج عام في مطعم تريدر فكس بفندق الريتز كارلتون، منطقة السيف، وقع بعد منتصف ليل 24 مايو 2024. المتهم سليمان عبدالمحسن سليمان (سعودي، 42 سنة) رفض الدفع وانخرط في سلوك غير منضبط مع إنفاذ القانون.\n\nتفاصيل الحادثة:\nوصل المتهم إلى المطعم في 23 مايو 2024 الساعة 10:00 مساءً وتناول المشروبات الكحولية. في 12:15 صباحاً، رفض دفع الفاتورة وأحدث إزعاجاً مع صراخ وسلوك مخل. اتصل مدير أمن المطعم عبدالعزيز ماهر أحمد بمركز شرطة العاصمة.\n\nاستجابة الشرطة:\nاستجاب العريفان علي أنور محمد وشهزاد أنجوم للموقع. كان المتهم غير متعاون للغاية، رفض إظهار الهوية، ادعى أنه \"محامٍ دولي\"، وطالب الضباط بالاتصال بالشرطة رغم تعريفهم. أهان كلا الضابطين أثناء أدائهم لواجبهم الرسمي. وضع الضباط الأصفاد ونقلوه إلى المركز.\n\nالأدلة الطبية:\nفي عيادة القلعة، أكد فحص الدم وجود حالة سُكر. خلال النقل، تسبب المتهم بإصابة وجهية طفيفة بنفسه بالأصفاد، شهد عليها كلا الضابطين. أدلى في البداية باتهامات اعتداء كاذبة ضد الضباط قبل التراجع والاعتذار بعد الصحو.\n\nالإجراءات القانونية:\nاتُهم بإهانة موظفين عموميين (المواد 75/5، 92/1-2، 107) وسُكر علني (المادة 306/1). قدم المتهم اعترافاً كاملاً خلال استجواب النيابة. حكمت المحكمة الجنائية الصغرى بالسجن 20 يوماً مع النفاذ الفوري في 12 يونيو 2024.\n\nالنتيجة:\nنُفذ الحكم. توضح القضية الاستجابة المناسبة لإنفاذ القانون، وجمع الأدلة السليم، والإجراءات القانونية الواجبة عبر نظام العدالة البحريني.",
        
        long: "ملخص تحقيق شامل\n\nنظرة عامة على القضية:\nيتناول هذا التحقيق احتيالاً مالياً كبيراً اكتُشف في شركة الخليج للتجارة خلال عملية التدقيق الربع سنوي في أكتوبر 2025. تتضمن القضية تحويلات أموال غير مصرح بها منهجية نُفذت على مدى فترة ثلاثة أشهر.\n\nشهادة الشاهد الرئيسي:\nقدم أحمد المحمود، الذي يعمل كمدير مالي، شهادة مفصلة بشأن اكتشاف وطبيعة المخالفات المالية. دوره المهني ومشاركته المباشرة في عملية التدقيق يؤسسان مصداقيته كشاهد رئيسي.\n\nالتفاصيل المالية:\n- المبلغ الإجمالي: حوالي 75,000 دينار بحريني\n- فترة المعاملات: من يوليو إلى سبتمبر 2025\n- عدد التحويلات: خمسة عشر معاملة منفصلة\n- المبالغ الفردية: تتراوح بين 3,000 و 8,000 دينار بحريني لكل تحويل\n- النمط: تنفيذ منهجي يشير إلى تخطيط متعمد\n\nتحديد المشتبه به:\nتم تحديد ليلى حسن كمشتبه به رئيسي. منصبها كمديرة حسابات سابقة وفر لها:\n- بيانات اعتماد وصول شرعية إلى النظام\n- معرفة بإجراءات الرقابة الداخلية\n- صلاحية معالجة المعاملات المالية\n- فهم للجداول الزمنية للتدقيق والإجراءات\n\nالدعم الإثباتي:\n1. كشوف حسابات بنكية: سجلات معاملات كاملة تظهر التحويلات غير المصرح بها\n2. مراسلات بريد إلكتروني: اتصالات رقمية تكشف نشاطاً مشبوهاً\n3. سجلات وصول إلى النظام: سجلات تظهر أنماط وصول بعد ساعات العمل\n4. وثائق مزورة: وثائق موافقة مزيفة أُنشئت للتحايل على الضوابط\n5. شاهد مؤيد: خالد محمد، المدقق الداخلي، الذي اكتشف الشذوذات في البداية\n\nالنتائج والتحليل:\nتظهر الأدلة خرقاً منهجياً للضوابط المالية نفذه فرد لديه معرفة داخلية ووصول إلى النظام. يشير نمط المعاملات بعد ساعات العمل والوثائق المزورة إلى سبق الإصرار والوعي بإجراءات التدقيق الداخلي.\n\nالإجراءات القانونية الموصى بها:\n1. إلقاء القبض الفوري على المشتبه به واستجوابه\n2. تجميد جميع الحسابات المالية المرتبطة بالمشتبه به\n3. إجراء تحليل شرعي مالي شامل\n4. مراجعة إجراءات الرقابة الداخلية\n5. تقييم الأطراف الإضافية المحتملة المتضررة\n\nتتطلب هذه القضية اهتماماً عاجلاً من الادعاء نظراً للأثر المالي الكبير والأدلة على الاحتيال المتعمد.",
        
        'extra-long': "تقرير تحقيق مفصل: احتيال مالي في شركة الخليج للتجارة\n\nالملخص التنفيذي:\nيوثق هذا التقرير الشامل تحقيقاً كبيراً في احتيال مالي في شركة الخليج للتجارة، اكتُشف خلال إجراءات التدقيق الربع سنوي الروتينية في أكتوبر 2025. يكشف التحقيق عن تحويلات مالية غير مصرح بها منهجية بإجمالي يقارب 75,000 دينار بحريني، نُفذت على مدى فترة ثلاثة أشهر من قبل موظفة سابقة لديها وصول متميز إلى النظام.\n\nخلفية القضية والاكتشاف:\nاكتُشفت المخالفات في البداية من قبل خالد محمد، المدقق الداخلي، خلال مراجعة امتثال روتينية أُجريت كجزء من دورة التدقيق الربع سنوي للشركة. دفع الاكتشاف إلى التصعيد الفوري إلى الإدارة المالية العليا، مما أدى إلى التحقيق الشامل الموثق هنا.\n\nشهادة الشاهد الرئيسي - أحمد المحمود (المدير المالي):\n\nبيانات اعتماد الشاهد:\nيشغل أحمد المحمود منصب المدير المالي في شركة الخليج للتجارة، مما يوفر له إشرافاً شاملاً على جميع العمليات المالية وإجراءات التدقيق وآليات الرقابة الداخلية. فترة خدمته ومكانته المهنية تثبته كشاهد ذو مصداقية عالية مع معرفة مباشرة بالأنظمة والإجراءات المالية للشركة.\n\nالجدول الزمني للشهادة والمحتوى:\n[00:00:15-00:00:25] التعريف الأولي وتأكيد الدور\n[00:00:25-00:00:45] اكتشاف المعاملات غير المصرح بها خلال تدقيق أكتوبر\n[00:00:45-00:01:05] النطاق الزمني ونمط النشاط الاحتيالي\n[00:01:05-00:01:25] تحديد المشتبه به وتفاصيل الوصول إلى النظام\n[00:01:25-00:01:50] التوثيق الإثباتي والمواد الداعمة\n[00:01:50-00:02:10] تحديد الشاهد المؤيد\n[00:02:10-00:02:30] الإجراءات الموصى بها واستنتاجات التحقيق\n\nالتحليل المالي:\n\nتفاصيل المعاملات:\n- المبلغ الإجمالي: 75,000 دينار بحريني (تقريبي)\n- الفترة الزمنية: يوليو 2025 حتى سبتمبر 2025\n- تكرار المعاملات: خمسة عشر تحويلاً منفصلاً\n- نطاق المعاملة الفردية: 3,000 إلى 8,000 دينار بحريني\n- متوسط قيمة المعاملة: 5,000 دينار بحريني\n- تحليل النمط: توزيع منهجي يشير إلى تهرب متعمد من عتبات كشف الاحتيال الآلي\n\nمنهجية الاحتيال:\nوظفت المشتبه به نهجاً متطوراً مصمماً للتحايل على الضوابط الداخلية وأنظمة المراقبة الآلية. من خلال الحفاظ على مبالغ المعاملات الفردية أقل من عتبات كشف الاحتيال النموذجية أثناء تنفيذ تحويلات متعددة، أظهرت الجانية معرفة مفصلة بإطار الرقابة الداخلية للشركة.\n\nملف المشتبه به:\n\nالتعريف: ليلى حسن\nالمنصب السابق: مديرة حسابات\nمستوى الوصول إلى النظام: وصول مصرح به إلى نظام الدفع\nحالة التوظيف: موظفة سابقة (تتطلب ظروف المغادرة التحقيق)\n\nالوصول والفرصة:\nوفر دور السيدة حسن كمديرة حسابات لها بيانات اعتماد شرعية لنظام معالجة الدفع. هذا الوصول المتميز، جنباً إلى جنب مع فهمها التفصيلي للإجراءات الداخلية والجداول الزمنية للتدقيق، خلق فرصة للاحتيال المنهجي. مكّنت المعرفة الداخلية للمشتبه به من استغلال الثغرات الإجرائية وتنفيذ المعاملات خلال فترات الإشراف المنخفض.\n\nالأنماط السلوكية:\nتكشف سجلات الوصول إلى النظام عن نمط مميز من النشاط بعد ساعات العمل، مما يشير إلى محاولات متعمدة لتجنب الكشف من خلال إجراء معاملات غير مصرح بها خارج ساعات العمل العادية عندما تم تقليل آليات الإشراف وتم تقليل احتمالية الكشف الفوري.\n\nالتوثيق الإثباتي:\n\n1. السجلات المصرفية:\nكشوف حسابات بنكية شاملة توثق جميع التحويلات غير المصرح بها الخمسة عشر، بما في ذلك:\n- طوابع زمنية كاملة للمعاملات\n- تفاصيل الحساب المستفيد\n- مبالغ التحويل وأرقام المرجع\n- معلومات التوجيه\n- تأكيدات المعاملات المقاصة\n\n2. الاتصالات الرقمية:\nمراسلات بريد إلكتروني تكشف:\n- اتصالات مشبوهة بشأن معالجة المعاملات\n- رسائل غير عادية بعد ساعات العمل\n- دليل محتمل على التخطيط والتنسيق\n- اتصالات تنحرف عن بروتوكولات الأعمال القياسية\n\n3. سجلات الوصول إلى النظام:\nسجلات تقنية مفصلة تظهر:\n- أنماط الوصول إلى النظام بعد ساعات العمل\n- معلومات عنوان IP\n- طوابع زمنية محددة للوصول غير المصرح به\n- الارتباط بين الوصول إلى النظام والمعاملات الاحتيالية\n- سجلات مصادقة المستخدم\n\n4. وثائق مزورة:\nأدلة مادية ورقمية على وثائق موافقة مزورة، بما في ذلك:\n- توقيعات تفويض مزيفة\n- نماذج موافقة ملفقة\n- وثائق أُنشئت لتوفير شرعية زائفة للمعاملات غير المصرح بها\n- تحليل مقارن مع إجراءات التفويض الشرعية\n\n5. شهادة مؤيدة:\nيعمل خالد محمد، المدقق الداخلي، كشاهد مؤيد مع:\n- الكشف الأولي عن التناقضات المالية\n- التحقق المستقل من نتائج التدقيق\n- الخبرة المهنية في الضوابط المالية\n- توثيق الجدول الزمني للاكتشاف\n\nنتائج التحقيق:\n\nالاستنتاجات الأولية:\n1. خرق منهجي للضوابط المالية نفذه شخص من الداخل مع وصول متميز\n2. احتيال مع سبق الإصرار يتضح من خلال تحليل النمط والوثائق المزورة\n3. استغلال الثغرات الإجرائية وفرص الوصول بعد ساعات العمل\n4. تأثير مالي كبير يتطلب تدخلاً قانونياً فورياً\n5. جودة الأدلة كافية لدعم الملاحقة القضائية\n\nتقييم المخاطر:\n- التأثير المالي: عالي (75,000 دينار بحريني مؤكد، إمكانية وجود معاملات إضافية غير مكتشفة)\n- مخاطر السمعة: متوسطة إلى عالية (خرق الضوابط الداخلية)\n- التعرض القانوني: يتطلب إجراءات فورية لإظهار العناية الواجبة\n- المخاطر المستمرة: يستلزم مراجعة شاملة لضوابط الوصول وإجراءات التدقيق\n\nالإجراءات القانونية الموصى بها:\n\nالإجراءات الفورية (خلال 24-48 ساعة):\n1. إصدار أمر بإلقاء القبض على المشتبه به\n2. تنفيذ أوامر تجميد الحسابات لجميع الحسابات المرتبطة بالمشتبه به\n3. تأمين جميع الأدلة المادية والرقمية\n4. مقابلة شهود محتملين إضافيين\n5. التنسيق مع المؤسسات المالية لتتبع المعاملات\n\nالإجراءات قصيرة المدى (خلال 1-2 أسابيع):\n1. إجراء تحليل شرعي مالي شامل\n2. مراجعة سجل المعاملات الكامل للمخالفات الإضافية\n3. تقييم نقاط الضعف في الرقابة الداخلية المستغلة في الاحتيال\n4. مقابلة جميع الموظفين الذين لديهم مستويات وصول مماثلة إلى النظام\n5. توثيق سلسلة الحيازة الكاملة لجميع الأدلة\n\nالإجراءات متوسطة المدى (خلال شهر واحد):\n1. إعداد ملف قضية ملاحقة قضائية شامل\n2. التنسيق مع المستشار القانوني لاستراتيجية القضية\n3. تنفيذ ضوابط داخلية معززة\n4. إجراء تدقيق على مستوى المنظمة للإجراءات المالية\n5. تقييم خيارات الاسترداد المدني المحتملة\n\nاعتبارات إضافية:\n\n1. ضحايا إضافيون محتملون: يجب أن يقيّم التحقيق ما إذا كان احتيال مماثل قد حدث لدى أرباب العمل السابقين\n2. استرداد الأصول: مطلوب إجراء فوري لتحديد وتأمين الأصول المحصلة بشكل احتيالي\n3. مراجعة الرقابة الداخلية: مطلوب تقييم شامل لمنع الحوادث المستقبلية\n4. حماية الشهود: النظر في تدابير الحماية للشهود المتعاونين إذا كان هناك خطر ترهيب\n5. الإفصاح العام: التنسيق مع قيادة الشركة بشأن توقيت ومحتوى الإفصاح العام المناسب\n\nالخلاصة:\nأثبت هذا التحقيق أدلة كبيرة على احتيال مالي منهجي نفذته موظفة سابقة لديها وصول متميز إلى النظام. يوفر التوثيق الشامل، بما في ذلك السجلات المالية والأدلة الرقمية وسجلات النظام والشهادة المؤيدة، أساساً قوياً للملاحقة القضائية. يُبرر الإجراء القانوني الفوري نظراً للتأثير المالي الكبير والأدلة الواضحة على سبق الإصرار والحاجة إلى إظهار تنفيذ فعال للضوابط المالية. تتطلب القضية اهتماماً عاجلاً من سلطات الادعاء لضمان العدالة وحماية المصالح التنظيمية والعامة."
      }
    };

    // Simulate realistic loading time (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the appropriate mock summary based on language and length
    const mockSummaryText = mockSummaries[selectedLanguage][summaryLength];

    // Create mock response matching API structure
    const mockResponse = {
      summary: mockSummaryText,
      summary_id: `SUMMARY-${Date.now()}`,
      case_id: currentCase?.caseId || 'CASE-2025-001',
      session_id: currentSession?.sessionId || sessionData.sessionId,
      user_id: 'prosecutor-202200471',
      timestamp: new Date().toISOString(),
      model: 'Mock Data (Demo Mode)',
      language: selectedLanguage,
      length: summaryLength
    };

    // Set the summary (no API call, no throttling!)
    setSummary(mockResponse);
    setLoading(false);
  };

  return (
    <div className="summarization-container">
      
      {/* Header */}
      <div className="summarization-header">
        <FileText className="summarization-header-icon" />
        <h2 className="summarization-title">
          {t('summarization.title')}
        </h2>
      </div>

      {/* Session Details */}
      <SessionDetailsCard
        sessionId={sessionData.sessionId}
        duration={sessionData.duration}
        personType={participantType}
        status={sessionData.status}
      />

      {/* Customization Panel */}
      <CustomizationPanel
        realTranscript={realTranscript}
        selectedLanguage={selectedLanguage}
        summaryLength={summaryLength}
        loading={loading}
        onLanguageChange={setSelectedLanguage}
        onLengthChange={setSummaryLength}
        onGenerate={generateSummary}
      />

      {/* Loading State */}
      {loading && <LoadingState />}

      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}

      {/* Summary Display */}
      {summary && !loading && (
        <SummaryDisplay
          summary={summary}
          selectedLanguage={selectedLanguage}
          sessionId={sessionData.sessionId}
        />
      )}
    </div>
  );
};

export default SummarizationReport;
