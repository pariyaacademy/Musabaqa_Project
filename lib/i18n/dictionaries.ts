/**
 * lib/i18n/dictionaries.ts
 *
 * Spec section 41: "Structure the application so Hausa can be added
 * later." This is that addition. Scoped to the pages a participant or
 * their family actually uses — home, competition detail, registration,
 * verification, and shared nav/footer. Admin and judge tooling stays
 * English-only for now (internal staff use, not the audience Hausa
 * support is for) — extending the same pattern to those pages later is
 * just adding more keys to this file, not restructuring anything.
 */

export const locales = ["en", "ha"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export interface Dictionary {
  nav: {
    competitions: string;
    verify: string;
    judgeQueue: string;
    admin: string;
    signIn: string;
    signOut: string;
  };
  footer: {
    textSource: string;
  };
  home: {
    heading1: string;
    heading2: string;
    subtext: string;
    viewCompetition: string;
    allCompetitions: string;
    noOtherCompetitions: string;
    venueTba: string;
    datesTba: string;
  };
  status: {
    REGISTRATION_OPEN: string;
    UPCOMING: string;
    LIVE: string;
    COMPLETED: string;
    REGISTRATION_CLOSED: string;
    ARCHIVED: string;
    DRAFT: string;
  };
  competition: {
    categories: string;
    noCategoriesYet: string;
    register: string;
    closed: string;
    rules: string;
    ageRange: string;
    maleOnly: string;
    femaleOnly: string;
    minutes: string;
    customRange: string;
  };
  register: {
    heading: string;
    intro: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    selectGender: string;
    male: string;
    female: string;
    city: string;
    state: string;
    country: string;
    organization: string;
    teacher: string;
    phone: string;
    email: string;
    submit: string;
    submitting: string;
    registeredHeading: string;
    registeredBody: string;
    participantIdNote: string;
  };
  verify: {
    heading: string;
    intro: string;
    placeholder: string;
    verifyButton: string;
    validCertificate: string;
    notFound: string;
    participant: string;
    competition: string;
    category: string;
    position: string;
    issueDate: string;
    downloadPdf: string;
  };
}

const en: Dictionary = {
  nav: {
    competitions: "Competitions",
    verify: "Verify a certificate",
    judgeQueue: "Judge queue",
    admin: "Admin",
    signIn: "Sign in",
    signOut: "Sign out",
  },
  footer: {
    textSource: "Qur'an text: Tanzil Project (tanzil.net), Uthmani script, Madinah Mushaf.",
  },
  home: {
    heading1: "Qur'an memorization,",
    heading2: "judged with care.",
    subtext:
      "Register for a Musabaqa, track results as they're published, and verify a certificate — all in one place.",
    viewCompetition: "View competition",
    allCompetitions: "All competitions",
    noOtherCompetitions: "No other competitions listed yet.",
    venueTba: "Venue TBA",
    datesTba: "Dates to be announced",
  },
  status: {
    REGISTRATION_OPEN: "Registration open",
    UPCOMING: "Upcoming",
    LIVE: "Live now",
    COMPLETED: "Completed",
    REGISTRATION_CLOSED: "Registration closed",
    ARCHIVED: "Archived",
    DRAFT: "Draft",
  },
  competition: {
    categories: "Categories",
    noCategoriesYet: "Categories haven't been published for this competition yet.",
    register: "Register",
    closed: "Closed",
    rules: "Rules",
    ageRange: "Ages",
    maleOnly: "Male only",
    femaleOnly: "Female only",
    minutes: "min",
    customRange: "Custom range",
  },
  register: {
    heading: "Register",
    intro:
      "Fields marked required must be completed. Your registration will be reviewed by the organizers before it's confirmed.",
    fullName: "Full name",
    dateOfBirth: "Date of birth",
    gender: "Gender",
    selectGender: "Select…",
    male: "Male",
    female: "Female",
    city: "City",
    state: "State",
    country: "Country",
    organization: "Organization / Madrasa",
    teacher: "Teacher",
    phone: "Phone",
    email: "Email",
    submit: "Submit registration",
    submitting: "Submitting…",
    registeredHeading: "Registered",
    registeredBody: "You're registered for",
    participantIdNote:
      "Keep this ID — it's how organizers will look up your registration. A QR check-in pass will be available once your registration is approved.",
  },
  verify: {
    heading: "Verify a certificate",
    intro: "Enter the certificate ID printed on the certificate (e.g. CERT-MQ26-00152).",
    placeholder: "CERT-MQ26-00152",
    verifyButton: "Verify",
    validCertificate: "Valid certificate",
    notFound: "No certificate found with that ID.",
    participant: "Participant",
    competition: "Competition",
    category: "Category",
    position: "Position",
    issueDate: "Issue date",
    downloadPdf: "Download PDF",
  },
};

const ha: Dictionary = {
  nav: {
    competitions: "Gasa-gasa",
    verify: "Tabbatar da takardar shaida",
    judgeQueue: "Jerin alkalai",
    admin: "Gudanarwa",
    signIn: "Shiga",
    signOut: "Fita",
  },
  footer: {
    textSource: "Rubutun Alqur'ani: Aikin Tanzil (tanzil.net), rubutun Usmani, Mushafin Madina.",
  },
  home: {
    heading1: "Haddar Alqur'ani,",
    heading2: "da kulawa sosai.",
    subtext:
      "Yi rajista don Musabaqa, ka bibiyi sakamako yayin da ake bugawa, kuma ka tabbatar da takardar shaida — duk a wuri guda.",
    viewCompetition: "Duba gasa",
    allCompetitions: "Duk gasa-gasa",
    noOtherCompetitions: "Babu wata gasa da aka jera tukuna.",
    venueTba: "Za a sanar da wurin taro",
    datesTba: "Za a sanar da ranaku",
  },
  status: {
    REGISTRATION_OPEN: "An bude rajista",
    UPCOMING: "Mai zuwa",
    LIVE: "Ana gudanarwa yanzu",
    COMPLETED: "An kammala",
    REGISTRATION_CLOSED: "An rufe rajista",
    ARCHIVED: "An adana",
    DRAFT: "Daftari",
  },
  competition: {
    categories: "Rukunoni",
    noCategoriesYet: "Ba a buga rukunonin wannan gasa ba tukuna.",
    register: "Yi rajista",
    closed: "An rufe",
    rules: "Ka'idoji",
    ageRange: "Shekaru",
    maleOnly: "Maza kadai",
    femaleOnly: "Mata kadai",
    minutes: "min",
    customRange: "Zangon musamman",
  },
  register: {
    heading: "Yi rajista",
    intro: "Dole a cika filayen da ake bukata. Masu shirya gasar za su duba rajistarku kafin a tabbatar.",
    fullName: "Cikakken suna",
    dateOfBirth: "Ranar haihuwa",
    gender: "Jinsi",
    selectGender: "Zaɓi…",
    male: "Namiji",
    female: "Mace",
    city: "Gari",
    state: "Jiha",
    country: "Kasa",
    organization: "Makarantar Alqur'ani / Madrasa",
    teacher: "Malami",
    phone: "Lambar waya",
    email: "Imel",
    submit: "Aika rajista",
    submitting: "Ana aikawa…",
    registeredHeading: "An yi rajista",
    registeredBody: "An yi maka rajista a",
    participantIdNote:
      "Ka ajiye wannan lambar — ta ce ake gane rajistarka. Za a samar da katin shiga na QR bayan an tabbatar da rajistarka.",
  },
  verify: {
    heading: "Tabbatar da takardar shaida",
    intro: "Shigar da lambar takardar shaidar da aka rubuta a kanta (misali CERT-MQ26-00152).",
    placeholder: "CERT-MQ26-00152",
    verifyButton: "Tabbatar",
    validCertificate: "Takardar shaida ingantacciya",
    notFound: "Ba a sami takardar shaida da wannan lambar ba.",
    participant: "Dan takara",
    competition: "Gasa",
    category: "Rukuni",
    position: "Matsayi",
    issueDate: "Ranar bayarwa",
    downloadPdf: "Sauke PDF",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, ha };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
