/* English / Telugu / Hindi for the customer pages.
   Exact-text dictionary + a few patterns for strings with numbers. Works on static
   text and on text the page scripts set later (MutationObserver). Original English is
   remembered so switching back is exact. Wording is plain and short; have a native
   speaker skim it once. */
(function () {
  var LANGS = [['en', 'EN'], ['te', 'తెలుగు'], ['hi', 'हिन्दी']];
  var D = {
    te: {
      'Track order': 'ఆర్డర్ ట్రాక్ చేయండి', 'Secure payments via Razorpay': 'Razorpay ద్వారా సురక్షిత చెల్లింపు', 'Prints in minutes': 'నిమిషాల్లో ప్రింట్', 'Made for India': 'భారతదేశం కోసం',
      'Upload': 'అప్‌లోడ్', 'Options': 'ఎంపికలు', 'Pay': 'చెల్లింపు',
      'I agree that DocuFast and this shop may process the document I upload only to print it.': 'నేను అప్‌లోడ్ చేసే పత్రాన్ని ప్రింట్ చేయడానికి మాత్రమే DocuFast మరియు ఈ షాప్ ఉపయోగించడానికి అంగీకరిస్తున్నాను.',
      'Privacy note': 'గోప్యతా సూచన',
      'A file': 'ఫైల్', 'Photos to PDF': 'ఫోటోలు → PDF', 'Photos → PDF': 'ఫోటోలు → PDF', 'Passport photos': 'పాస్‌పోర్ట్ ఫోటోలు',
      'Drop a file here, or tap to choose': 'ఫైల్ ఇక్కడ వదలండి, లేదా తాకి ఎంచుకోండి', 'PDF, JPG, PNG, DOCX — up to 25MB': 'PDF, JPG, PNG, DOCX — 25MB వరకు',
      'Take a photo of a document': 'పత్రం ఫోటో తీయండి',
      'Add several photos or PDFs. We join them, in this order, into one PDF.': 'పలు ఫోటోలు లేదా PDFలు జోడించండి. వాటిని ఈ క్రమంలో ఒకే PDFగా కలుపుతాము.',
      'Add photos or PDFs': 'ఫోటోలు లేదా PDFలు జోడించండి', 'Brighten dim photos': 'మసక ఫోటోలను ప్రకాశవంతం చేయి', 'Add photos first': 'ముందు ఫోటోలు జోడించండి',
      'Pick one clear face photo. We put copies of it on a single A4 sheet at 35 × 45 mm, ready to cut.': 'స్పష్టమైన ఒక ముఖ ఫోటో ఎంచుకోండి. దాని కాపీలను ఒక A4 షీట్‌పై 35 × 45 mm పరిమాణంలో, కత్తిరించడానికి సిద్ధంగా ఉంచుతాము.',
      'Choose photo': 'ఫోటో ఎంచుకోండి', 'Rotate': 'తిప్పండి', 'Photos on the sheet': 'షీట్‌లో ఫోటోల సంఖ్య', 'Make photo sheet': 'ఫోటో షీట్ తయారు చేయండి',
      'Add each document. Phone photos or PDFs both work.': 'ప్రతి పత్రం జోడించండి. ఫోన్ ఫోటోలు లేదా PDFలు రెండూ పనిచేస్తాయి.',
      'Printing charges only': 'ప్రింటింగ్ ఛార్జీలు మాత్రమే', 'Combine my documents': 'నా పత్రాలను కలపండి',
      'Number of pages': 'పేజీల సంఖ్య', 'Choose a file to continue': 'కొనసాగడానికి ఫైల్ ఎంచుకోండి', 'Continue': 'కొనసాగించండి', 'Back': 'వెనక్కి',
      'Colour': 'రంగు', 'Black & white': 'నలుపు–తెలుపు', 'Sides': 'వైపులు', 'Single-sided': 'ఒక వైపు', 'One side of each sheet': 'ప్రతి షీట్‌కు ఒక వైపు', 'Double-sided': 'రెండు వైపులా', 'Both sides of the sheet': 'షీట్ రెండు వైపులా', 'Copies': 'కాపీలు',
      'Have a coupon code?': 'కూపన్ కోడ్ ఉందా?', 'Apply': 'వర్తింపజేయి', 'Business account code (optional)': 'వ్యాపార ఖాతా కోడ్ (ఐచ్ఛికం)', 'Use': 'వాడు', 'Remove': 'తొలగించు',
      'Pay & print': 'చెల్లించి ప్రింట్ చేయండి', 'Pay securely with UPI, cards, or net banking via Razorpay.': 'Razorpay ద్వారా UPI, కార్డులు లేదా నెట్ బ్యాంకింగ్‌తో సురక్షితంగా చెల్లించండి.',
      'Total': 'మొత్తం', 'Paid': 'చెల్లించారు', 'Order code': 'ఆర్డర్ కోడ్',
      'Track this order (save this link)': 'ఈ ఆర్డర్ ట్రాక్ చేయండి (ఈ లింక్ భద్రపరచండి)', 'Upload another file': 'మరో ఫైల్ అప్‌లోడ్ చేయండి',
      'Please tick the consent box above before choosing a file.': 'ఫైల్ ఎంచుకునే ముందు పైన ఉన్న అంగీకార బాక్స్‌ను టిక్ చేయండి.',
      'Compressing image…': 'చిత్రాన్ని కుదిస్తున్నాము…', 'Uploading…': 'అప్‌లోడ్ అవుతోంది…', 'Uploading file…': 'ఫైల్ అప్‌లోడ్ అవుతోంది…', 'Detecting pages…': 'పేజీలను లెక్కిస్తున్నాము…', 'Detecting page count…': 'పేజీల సంఖ్య లెక్కిస్తున్నాము…',
      '✓ Uploaded': '✓ అప్‌లోడ్ అయింది', 'Choose a different file': 'వేరే ఫైల్ ఎంచుకోండి', 'Creating order…': 'ఆర్డర్ తయారవుతోంది…', 'Verifying payment…': 'చెల్లింపు ధృవీకరిస్తున్నాము…', 'Checking…': 'తనిఖీ చేస్తున్నాము…',
      'We could not count the pages automatically — please enter how many pages to print.': 'పేజీలను స్వయంగా లెక్కించలేకపోయాము — ఎన్ని పేజీలు ప్రింట్ చేయాలో నమోదు చేయండి.',
      'Your document is printing — collect it from the tray.': 'మీ పత్రం ప్రింట్ అవుతోంది — ట్రే నుండి తీసుకోండి.', '✓ Printed': '✓ ప్రింట్ అయింది', 'Payment received': 'చెల్లింపు అందింది', 'Paid — printing soon': 'చెల్లించారు — త్వరలో ప్రింట్',
      'Payment confirmed. Sending to printer…': 'చెల్లింపు నిర్ధారించబడింది. ప్రింటర్‌కు పంపుతున్నాము…', 'Printing now — collect it from the tray.': 'ఇప్పుడు ప్రింట్ అవుతోంది — ట్రే నుండి తీసుకోండి.',
      'Order status': 'ఆర్డర్ స్థితి', 'Track your order': 'మీ ఆర్డర్ ట్రాక్ చేయండి', 'Enter the 6-character code from your receipt.': 'మీ రసీదులోని 6 అక్షరాల కోడ్ నమోదు చేయండి.', 'Check': 'చూడండి',
      'Your recent orders on this phone': 'ఈ ఫోన్‌లో మీ ఇటీవలి ఆర్డర్లు', 'New print': 'కొత్త ప్రింట్',
      'Waiting for payment': 'చెల్లింపు కోసం వేచి ఉంది', 'Your order is created but payment has not completed.': 'మీ ఆర్డర్ తయారైంది కానీ చెల్లింపు పూర్తి కాలేదు.', 'Printing': 'ప్రింటింగ్', 'Ready to collect': 'తీసుకోవడానికి సిద్ధం',
      'Waiting for the shop': 'షాప్ కోసం వేచి ఉంది', 'Sending to the printer now': 'ఇప్పుడు ప్రింటర్‌కు పంపుతున్నాము',
      'If money was deducted, wait a minute and refresh. Otherwise go back and pay again.': 'డబ్బు కట్ అయితే, ఒక నిమిషం వేచి రిఫ్రెష్ చేయండి. లేకపోతే వెనక్కి వెళ్లి మళ్లీ చెల్లించండి.',
      'You can ask the shop to switch on the print computer. Your file is safe and your code stays valid.': 'ప్రింట్ కంప్యూటర్ ఆన్ చేయమని షాప్‌ను అడగవచ్చు. మీ ఫైల్ సురక్షితం, కోడ్ చెల్లుబాటులోనే ఉంటుంది.',
      'Collect it from the tray and show this code if asked.': 'ట్రే నుండి తీసుకుని, అడిగితే ఈ కోడ్ చూపించండి.', 'Done! Your document has been printed.': 'పూర్తయింది! మీ పత్రం ప్రింట్ అయింది.',
      'Printing hit a problem': 'ప్రింటింగ్‌లో సమస్య వచ్చింది', 'Refunded': 'వాపసు చేశాము', 'Your money is on its way back to the original payment method.': 'మీ డబ్బు అసలు చెల్లింపు పద్ధతికి తిరిగి వస్తోంది.',
      'This order was refunded. Banks usually take 5–7 working days to show it.': 'ఈ ఆర్డర్ వాపసు చేయబడింది. బ్యాంకులు చూపించడానికి సాధారణంగా 5–7 పని దినాలు పడుతుంది.',
      'Order expired': 'ఆర్డర్ గడువు ముగిసింది', 'The file was removed from our system.': 'ఫైల్ మా వ్యవస్థ నుండి తొలగించబడింది.', 'Please upload your document again.': 'దయచేసి మీ పత్రాన్ని మళ్లీ అప్‌లోడ్ చేయండి.',
      'Order history': 'ఆర్డర్ చరిత్ర', 'View payment receipt': 'చెల్లింపు రసీదు చూడండి', 'Copy link to this order': 'ఈ ఆర్డర్ లింక్ కాపీ చేయండి', 'Print something else': 'ఇంకేదైనా ప్రింట్ చేయండి',
      'Delete my file now': 'నా ఫైల్‌ను ఇప్పుడే తొలగించండి', 'Link copied ✓': 'లింక్ కాపీ అయింది ✓', 'Enter the code from your receipt.': 'మీ రసీదులోని కోడ్ నమోదు చేయండి.',
      'No order found with that code. Check it and try again.': 'ఆ కోడ్‌తో ఆర్డర్ కనబడలేదు. సరిచూసి మళ్లీ ప్రయత్నించండి.',
      'Removes your uploaded document from our storage. The order record (code, pages, amount) stays for accounts.': 'మీ అప్‌లోడ్ చేసిన పత్రం మా నిల్వ నుండి తొలగించబడుతుంది. ఆర్డర్ రికార్డు (కోడ్, పేజీలు, మొత్తం) లెక్కల కోసం ఉంటుంది.',
      'Order created': 'ఆర్డర్ తయారైంది', 'Printed': 'ప్రింట్ అయింది', 'Print problem': 'ప్రింట్ సమస్య'
    },
    hi: {
      'Track order': 'ऑर्डर ट्रैक करें', 'Secure payments via Razorpay': 'Razorpay से सुरक्षित भुगतान', 'Prints in minutes': 'मिनटों में प्रिंट', 'Made for India': 'भारत के लिए',
      'Upload': 'अपलोड', 'Options': 'विकल्प', 'Pay': 'भुगतान',
      'I agree that DocuFast and this shop may process the document I upload only to print it.': 'मैं सहमत हूँ कि DocuFast और यह दुकान मेरे अपलोड किए दस्तावेज़ का उपयोग केवल प्रिंट करने के लिए करें।',
      'Privacy note': 'गोपनीयता नोट',
      'A file': 'फ़ाइल', 'Photos to PDF': 'फ़ोटो → PDF', 'Photos → PDF': 'फ़ोटो → PDF', 'Passport photos': 'पासपोर्ट फ़ोटो',
      'Drop a file here, or tap to choose': 'फ़ाइल यहाँ छोड़ें, या चुनने के लिए टैप करें', 'PDF, JPG, PNG, DOCX — up to 25MB': 'PDF, JPG, PNG, DOCX — 25MB तक',
      'Take a photo of a document': 'दस्तावेज़ की फ़ोटो लें',
      'Add several photos or PDFs. We join them, in this order, into one PDF.': 'कई फ़ोटो या PDF जोड़ें। हम उन्हें इसी क्रम में एक PDF बना देंगे।',
      'Add photos or PDFs': 'फ़ोटो या PDF जोड़ें', 'Brighten dim photos': 'धुंधली फ़ोटो को उजला करें', 'Add photos first': 'पहले फ़ोटो जोड़ें',
      'Pick one clear face photo. We put copies of it on a single A4 sheet at 35 × 45 mm, ready to cut.': 'चेहरे की एक साफ़ फ़ोटो चुनें। हम उसकी कॉपियाँ एक A4 शीट पर 35 × 45 mm में, काटने के लिए तैयार रखेंगे।',
      'Choose photo': 'फ़ोटो चुनें', 'Rotate': 'घुमाएँ', 'Photos on the sheet': 'शीट पर फ़ोटो', 'Make photo sheet': 'फ़ोटो शीट बनाएँ',
      'Add each document. Phone photos or PDFs both work.': 'हर दस्तावेज़ जोड़ें। फ़ोन की फ़ोटो या PDF दोनों चलेंगे।',
      'Printing charges only': 'सिर्फ़ प्रिंटिंग शुल्क', 'Combine my documents': 'मेरे दस्तावेज़ मिलाएँ',
      'Number of pages': 'पेजों की संख्या', 'Choose a file to continue': 'आगे बढ़ने के लिए फ़ाइल चुनें', 'Continue': 'आगे बढ़ें', 'Back': 'वापस',
      'Colour': 'रंगीन', 'Black & white': 'ब्लैक & व्हाइट', 'Sides': 'तरफ़', 'Single-sided': 'एक तरफ़', 'One side of each sheet': 'हर शीट की एक तरफ़', 'Double-sided': 'दोनों तरफ़', 'Both sides of the sheet': 'शीट की दोनों तरफ़', 'Copies': 'कॉपियाँ',
      'Have a coupon code?': 'कूपन कोड है?', 'Apply': 'लगाएँ', 'Business account code (optional)': 'बिज़नेस अकाउंट कोड (वैकल्पिक)', 'Use': 'उपयोग', 'Remove': 'हटाएँ',
      'Pay & print': 'भुगतान करें और प्रिंट करें', 'Pay securely with UPI, cards, or net banking via Razorpay.': 'Razorpay से UPI, कार्ड या नेट बैंकिंग द्वारा सुरक्षित भुगतान करें।',
      'Total': 'कुल', 'Paid': 'भुगतान हुआ', 'Order code': 'ऑर्डर कोड',
      'Track this order (save this link)': 'इस ऑर्डर को ट्रैक करें (यह लिंक सहेजें)', 'Upload another file': 'दूसरी फ़ाइल अपलोड करें',
      'Please tick the consent box above before choosing a file.': 'फ़ाइल चुनने से पहले ऊपर सहमति बॉक्स पर टिक करें।',
      'Compressing image…': 'चित्र छोटा कर रहे हैं…', 'Uploading…': 'अपलोड हो रहा है…', 'Uploading file…': 'फ़ाइल अपलोड हो रही है…', 'Detecting pages…': 'पेज गिन रहे हैं…', 'Detecting page count…': 'पेजों की संख्या गिन रहे हैं…',
      '✓ Uploaded': '✓ अपलोड हो गया', 'Choose a different file': 'दूसरी फ़ाइल चुनें', 'Creating order…': 'ऑर्डर बन रहा है…', 'Verifying payment…': 'भुगतान जाँच रहे हैं…', 'Checking…': 'जाँच रहे हैं…',
      'We could not count the pages automatically — please enter how many pages to print.': 'पेज अपने आप नहीं गिन सके — कृपया बताएँ कितने पेज प्रिंट करने हैं।',
      'Your document is printing — collect it from the tray.': 'आपका दस्तावेज़ प्रिंट हो रहा है — ट्रे से ले लें।', '✓ Printed': '✓ प्रिंट हो गया', 'Payment received': 'भुगतान मिल गया', 'Paid — printing soon': 'भुगतान हुआ — जल्द प्रिंट होगा',
      'Payment confirmed. Sending to printer…': 'भुगतान की पुष्टि हुई। प्रिंटर को भेज रहे हैं…', 'Printing now — collect it from the tray.': 'अभी प्रिंट हो रहा है — ट्रे से ले लें।',
      'Order status': 'ऑर्डर की स्थिति', 'Track your order': 'अपना ऑर्डर ट्रैक करें', 'Enter the 6-character code from your receipt.': 'अपनी रसीद का 6 अक्षर का कोड डालें।', 'Check': 'देखें',
      'Your recent orders on this phone': 'इस फ़ोन पर आपके हाल के ऑर्डर', 'New print': 'नया प्रिंट',
      'Waiting for payment': 'भुगतान का इंतज़ार', 'Your order is created but payment has not completed.': 'आपका ऑर्डर बन गया है पर भुगतान पूरा नहीं हुआ।', 'Printing': 'प्रिंटिंग', 'Ready to collect': 'लेने के लिए तैयार',
      'Waiting for the shop': 'दुकान का इंतज़ार', 'Sending to the printer now': 'अभी प्रिंटर को भेज रहे हैं',
      'If money was deducted, wait a minute and refresh. Otherwise go back and pay again.': 'अगर पैसे कट गए हैं तो एक मिनट रुककर रिफ़्रेश करें। नहीं तो वापस जाकर फिर भुगतान करें।',
      'You can ask the shop to switch on the print computer. Your file is safe and your code stays valid.': 'आप दुकान से प्रिंट कंप्यूटर चालू करने को कह सकते हैं। आपकी फ़ाइल सुरक्षित है और कोड मान्य रहेगा।',
      'Collect it from the tray and show this code if asked.': 'ट्रे से ले लें और पूछने पर यह कोड दिखाएँ।', 'Done! Your document has been printed.': 'हो गया! आपका दस्तावेज़ प्रिंट हो गया है।',
      'Printing hit a problem': 'प्रिंटिंग में समस्या आई', 'Refunded': 'रिफ़ंड हुआ', 'Your money is on its way back to the original payment method.': 'आपके पैसे मूल भुगतान माध्यम में वापस आ रहे हैं।',
      'This order was refunded. Banks usually take 5–7 working days to show it.': 'यह ऑर्डर रिफ़ंड हो गया है। बैंक में दिखने में आमतौर पर 5–7 कार्य दिवस लगते हैं।',
      'Order expired': 'ऑर्डर की अवधि समाप्त', 'The file was removed from our system.': 'फ़ाइल हमारे सिस्टम से हटा दी गई।', 'Please upload your document again.': 'कृपया अपना दस्तावेज़ फिर अपलोड करें।',
      'Order history': 'ऑर्डर इतिहास', 'View payment receipt': 'भुगतान रसीद देखें', 'Copy link to this order': 'इस ऑर्डर का लिंक कॉपी करें', 'Print something else': 'कुछ और प्रिंट करें',
      'Delete my file now': 'मेरी फ़ाइल अभी हटाएँ', 'Link copied ✓': 'लिंक कॉपी हुआ ✓', 'Enter the code from your receipt.': 'अपनी रसीद का कोड डालें।',
      'No order found with that code. Check it and try again.': 'इस कोड से कोई ऑर्डर नहीं मिला। जाँचकर फिर कोशिश करें।',
      'Removes your uploaded document from our storage. The order record (code, pages, amount) stays for accounts.': 'आपका अपलोड किया दस्तावेज़ हमारे स्टोरेज से हट जाएगा। ऑर्डर रिकॉर्ड (कोड, पेज, रकम) हिसाब के लिए रहेगा।',
      'Order created': 'ऑर्डर बना', 'Printed': 'प्रिंट हुआ', 'Print problem': 'प्रिंट में समस्या'
    }
  };
  // Strings with numbers/names. Each: [regex, {te: fn, hi: fn}].
  var P = [
    [/^Printing at (.+)$/, { te: function (m) { return m[1] + ' లో ప్రింటింగ్'; }, hi: function (m) { return m[1] + ' में प्रिंटिंग'; } }],
    [/^(.+) per page$/, { te: function (m) { return 'పేజీకి ' + m[1]; }, hi: function (m) { return 'प्रति पेज ' + m[1]; } }],
    [/^✓ (.+) — (\d+) pages? detected$/, { te: function (m) { return '✓ ' + m[1] + ' — ' + m[2] + ' పేజీలు గుర్తించాము'; }, hi: function (m) { return '✓ ' + m[1] + ' — ' + m[2] + ' पेज मिले'; } }],
    [/^(.+) · (\d+) pages?$/, { te: function (m) { return m[1] + ' · ' + m[2] + ' పేజీలు'; }, hi: function (m) { return m[1] + ' · ' + m[2] + ' पेज'; } }],
    [/^Uploading… (\d+)%$/, { te: function (m) { return 'అప్‌లోడ్ అవుతోంది… ' + m[1] + '%'; }, hi: function (m) { return 'अपलोड हो रहा है… ' + m[1] + '%'; } }],
    [/^Service fee (.+) \+ printing$/, { te: function (m) { return 'సర్వీస్ ఫీజు ' + m[1] + ' + ప్రింటింగ్'; }, hi: function (m) { return 'सर्विस शुल्क ' + m[1] + ' + प्रिंटिंग'; } }],
    [/^Make PDF from (\d+) items?$/, { te: function (m) { return m[1] + ' వాటితో PDF తయారు చేయండి'; }, hi: function (m) { return m[1] + ' से PDF बनाएँ'; } }],
    [/^Add (\d+) more required documents?$/, { te: function (m) { return 'ఇంకా ' + m[1] + ' అవసరమైన పత్రాలు జోడించండి'; }, hi: function (m) { return 'और ' + m[1] + ' ज़रूरी दस्तावेज़ जोड़ें'; } }],
    [/^(\d+) orders? ahead of yours$/, { te: function (m) { return 'మీ ముందు ' + m[1] + ' ఆర్డర్లు ఉన్నాయి'; }, hi: function (m) { return 'आपके आगे ' + m[1] + ' ऑर्डर हैं'; } }],
    [/^Bill to (.+) & print$/, { te: function (m) { return m[1] + ' ఖాతాకు బిల్ చేసి ప్రింట్ చేయండి'; }, hi: function (m) { return m[1] + ' खाते में बिल करें और प्रिंट करें'; } }],
    [/^Billing to (.+) — no payment needed now\.$/, { te: function (m) { return m[1] + ' ఖాతాకు బిల్ అవుతుంది — ఇప్పుడు చెల్లింపు అవసరం లేదు.'; }, hi: function (m) { return m[1] + ' खाते में बिल होगा — अभी भुगतान की ज़रूरत नहीं।'; } }]
  ];
  var lang = 'en';
  try { lang = localStorage.getItem('df_lang') || ''; } catch (e) { /* ignore */ }
  if (!lang) { var nl = (navigator.language || '').slice(0, 2); lang = (nl === 'te' || nl === 'hi') ? nl : 'en'; }
  var orig = new WeakMap(), origAttr = new WeakMap();

  function tr(s) {
    if (lang === 'en') return null;
    var k = s.trim(); if (!k) return null;
    var d = D[lang]; if (d && d[k] !== undefined) return s.replace(k, d[k]);
    for (var i = 0; i < P.length; i++) { var m = k.match(P[i][0]); if (m) return s.replace(k, P[i][1][lang](m)); }
    return null;
  }
  function textNode(n) {
    var cur = n.nodeValue, o = orig.get(n);
    if (o !== undefined && cur === o.t) return;          // we set it ourselves; nothing new
    var t = tr(cur);
    if (t !== null) { orig.set(n, { e: cur, t: t }); n.nodeValue = t; } else if (o !== undefined) orig.delete(n);
  }
  function attrs(el) {
    ['placeholder', 'aria-label', 'title'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a); if (!v) return;
      var rec = origAttr.get(el) || {}; var e = rec[a] && rec[a].t === v ? rec[a].e : v;
      var t = lang === 'en' ? null : tr(e);
      if (t !== null) { rec[a] = { e: e, t: t }; el.setAttribute(a, t); origAttr.set(el, rec); }
      else if (rec[a] && lang === 'en') { el.setAttribute(a, rec[a].e); delete rec[a]; }
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { return textNode(root); }
    if (root.nodeType !== 1) return;
    var tag = root.tagName; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    attrs(root);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function restore(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var o = orig.get(n); if (o !== undefined) { if (n.nodeValue === o.t) n.nodeValue = o.e; orig.delete(n); } }
  }
  var obs = new MutationObserver(function (list) {
    obs.disconnect();
    list.forEach(function (m) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(walk);
    });
    observe();
  });
  function observe() { obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] }); }
  function apply() {
    obs.disconnect();
    if (lang === 'en') { restore(document.body); document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(attrs); } else walk(document.body);
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-sw button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === lang); });
    observe();
  }
  window.dfLang = function () { return lang; };
  function setLang(l) { lang = l; try { localStorage.setItem('df_lang', l); } catch (e) { /* ignore */ } apply(); }

  function init() {
    var host = document.querySelector('.brand-band .inner'); if (host) {
      var sw = document.createElement('div'); sw.className = 'lang-sw'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Language');
      LANGS.forEach(function (l) { var b = document.createElement('button'); b.type = 'button'; b.dataset.l = l[0]; b.textContent = l[1]; b.addEventListener('click', function () { setLang(l[0]); }); sw.appendChild(b); });
      host.appendChild(sw);
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
