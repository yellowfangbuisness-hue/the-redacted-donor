// The knowledge check asked before and after the story, and the three-part debrief shown after it.
// Each question has one correct option (`answer` is its index).
export const QUIZ = [
  { topic: 'Recognise', q: 'Which of these is a warning sign of trafficking for organ removal?',
    options: ['A hospital asks a donor to meet an independent advocate.', 'A job or loan offer comes with a “routine” blood and tissue test, a new debt and a held passport.', 'An official donor programme explains the risks and gives you time to decide.'], answer: 1 },
  { topic: 'Understand', q: 'Someone signs a form agreeing to donate a kidney. Is that always consent?',
    options: ['Yes. A signature is consent.', 'Yes, as long as they are paid fairly.', 'No. Consent must be informed and freely given. Debt, threats or lies cancel it.'], answer: 2 },
  { topic: 'Respond', q: 'You suspect someone is being trafficked for an organ. What helps most?',
    options: ['Confront the recruiter yourself.', 'Report it to the police or an anti-trafficking helpline, and to a trusted organisation.', 'Post the person’s name and photo online.'], answer: 1 },
];
// Debrief cards: [front (what the player taps), back (what it reveals)].
export const DEBRIEF = [
  { tab: 'Recognise', lead: 'Four things in Mateo’s case gave the recruiters away. Turn each card.', cards: [
    ['The offer', 'Pay far above the going rate, no experience, start at once. A real employer can be checked: a registered office, a contract you can read first, a consulate that knows them.'],
    ['The debt', 'A sudden fee for “processing”, travel or medical tests. That is debt bondage: the sum grows faster than anyone could repay, and it is used to control.'],
    ['The papers', 'They kept his passport “for safekeeping”. No employer or agent has the right to hold your identity documents.'],
    ['The pressure', 'Sign tonight. Tell no one. Haste and isolation are how a choice is taken away.'],
  ] },
  { tab: 'Understand', lead: 'Why Mateo’s signature meant nothing. Turn each card.', cards: [
    ['What consent needs', 'It must be informed and freely given, and the donor can withdraw it. They must understand the risks and be under no pressure.'],
    ['Donation or trafficking?', 'Legal donation is voluntary, unpaid and overseen by an authorised transplant body. Trafficking for organ removal uses deception, debt or force. The crime is the exploitation of a person.'],
    ['A network', 'Recruiters, brokers, couriers and complicit medical staff each play a part. No single paper shows the whole chain.'],
    ['What hospitals can do', 'Independent donor advocates, checks on how donor and recipient are connected, open records, and refusing transplant tourism.'],
  ] },
  { tab: 'Respond', lead: 'What you can do. Turn each card, then follow a link.', cards: [
    ['If you suspect trafficking', 'Do not confront the people involved. Call the police or your country’s emergency number (112 in India and the EU), or a national anti-trafficking helpline.'],
    ['Protecting survivors', 'A survivor is the victim of a crime, never the criminal. They may need medical care, safe housing, legal aid and time. Never share their name or image.'],
    ['Giving safely', 'To become an organ donor, register only through your country’s official programme. In India that is NOTTO.'],
  ], links: [
    ['UNODC: human trafficking', 'https://www.unodc.org/unodc/en/human-trafficking/'],
    ['WHO: transplantation', 'https://www.who.int/health-topics/transplantation'],
    ['NOTTO: India’s organ donation programme', 'https://notto.mohfw.gov.in/'],
  ] },
  // Every claim here is from the two sources linked under the cards.
  { tab: 'Myths', lead: 'Four things people get wrong about organ trafficking. Turn each card.', cards: [
    ['“Victims are snatched off the street”', 'Most are recruited. A job, a loan or a cash offer comes first, aimed at people in poverty or debt. The promised money often never arrives. (UNODC)'],
    ['“They signed, so they agreed”', 'Consent does not count when it was won by deception, fraud or abuse of someone’s vulnerability. (UNODC)'],
    ['“It is about hearts”', 'The organ taken most often is a kidney, then part of a liver: organs a living person can lose. Many victims are left unpaid, and some get no care after the operation. (UNODC)'],
    ['“Selling a kidney clears the debt”', 'Of 305 people who sold a kidney in Chennai, 96% did it to pay debts. Six years later three in four were still in debt and 86% were in worse health. (JAMA, 2002)'],
  ], links: [
    ['UNODC: trafficking for organ removal, explained', 'https://www.unodc.org/unodc/frontpage/2024/June/explainer_-understanding-human-trafficking-for-organ-removal.html'],
    ['JAMA 2002: selling a kidney in India', 'https://doi.org/10.1001/jama.288.13.1589'],
  ] },
];
export const MESSAGE = 'A signature is not consent when the choice is taken away.';
