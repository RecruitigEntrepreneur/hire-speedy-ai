import type de from './de';
import type { Messages } from '../../types';

// Norsk bokmål. Tiltale: du.
const nb: Messages<typeof de> = {
  q: {
    firmengroesse: {
      text: 'Hvor mange ansatte har dere i dag?',
      why: 'Kandidaten spør om det i første samtale, og rekruttereren trenger det når kandidater kontaktes.',
      chapter: 'Bedrift',
    },
    verguetung: {
      text: 'Hvilket spenn ligger fastlønnen i?',
      why: 'Uten et lønnsspenn kan ingen rekrutterer kontakte kandidater — det er det første alle kandidater spør om.',
      chapter: 'Lønn og godtgjørelse',
    },
    kriterien: {
      text: 'Hvilke 3 kriterier må kandidaten oppfylle for at dere skal kunne sette personen rett i arbeid og helt sikkert vil møte vedkommende?',
      kurz: 'Hvor absolutt er hvert av disse kriteriene?',
      intro: 'Ut fra det vi nettopp har gått gjennom om arbeidshverdagen og utfordringene:',
      why: 'Gjør en ønskeliste til en tydelig søkeprofil. Alt annet kan forhandles.',
      chapter: 'Kompetanse',
    },
    team: {
      text: 'Hvordan er avdelingen rundt stillingen bygget opp?',
      textFreelance: 'Hvordan er prosjektteamet satt sammen, og hvem andre jobber eksternt i det?',
      why: 'En jobb der man står alene, krever en annen person enn en rolle i et team på 15.',
      chapter: 'Nøkkelopplysninger',
    },
    arbeitszeit: {
      text: 'Hvordan er arbeidstiden (kjernetid) hos dere? Hvordan håndterer dere hjemmekontor og overtid?',
      textFreelance: 'Hvor fritt disponerer personen tiden sin — og hvordan dokumenteres arbeidet?',
      why: 'Den vanligste grunnen til at kandidater takker nei på tampen — de spør tidlig om det.',
      chapter: 'Arbeidstid og prosess',
    },
    gremien: {
      text: 'Har bedriften et ansattutvalg (tysk Betriebsrat)? (Hvis ja, når møtes det?)',
      why: 'Påvirker tiden fram til et tilbud mer enn noe annet steg i prosessen.',
      chapter: 'Arbeidstid og prosess',
    },
    vertragstempo: {
      text: 'Hvor lang tid bruker dere på å utarbeide kontrakten? (Sendes den digitalt?)',
      why: 'Mellom muntlig tilbud og kontrakt mister man kandidater til raskere konkurrenter.',
      chapter: 'Arbeidstid og prosess',
    },
    arbeitserlaubnis: {
      text: 'Må kandidaten ha arbeidstillatelse, eller bistår dere med visum?',
      why: 'Et avgjørende kriterium: uten svaret kontakter rekruttereren kandidater som ikke får begynne.',
      chapter: 'Arbeidstid og prosess',
    },
    abwerbeschutz: {
      text: 'Hvilke selskaper kan vi under ingen omstendigheter hente kandidater fra?',
      why: 'Den som henter folk fra kundens kunde, skader forretningsforholdet. Bare rekruttereren ser dette, og først når søket er i gang.',
      chapter: 'Arbeidstid og prosess',
    },
    vakanz: {
      text: 'Hvorfor er stillingen ledig? Når må den være besatt, og hvilke negative følger kan det få om den blir stående åpen lenger?',
      textFreelance: 'Hvorfor trenger dere ekstern kapasitet? Fra når — og hva skjer hvis ingen er på plass?',
      why: 'Avgjør historien, hastegraden og risikoen — og står aldri i noen annonse.',
      chapter: 'Tidsplan og kontrakt',
    },
    alltag: {
      text: 'Kan du beskrive hvordan arbeidshverdagen til kandidaten ser ut?',
      why: 'Rekruttereren forteller om denne hverdagen i samtalen med kandidaten. Uten den forblir rollen abstrakt.',
      chapter: 'Rolle og omfang',
    },
    entscheidung: {
      text: 'Hvem rapporterer kandidaten til, og er andre enn deg med i den endelige beslutningen?',
      why: 'Den som vet det, kan rette argumentene mot riktig person.',
      chapter: 'Prosess og beslutningstakere',
    },
    auswahlprozess: {
      text: 'Hvordan foregår utvelgelsen hos dere: hvor mange intervjuer, med hvem, er det en caseoppgave eller en prøvedag?',
      why: 'Kandidater spør om dette i første samtale. Den som kjenner løpet, trekker seg sjeldnere.',
      chapter: 'Prosess og beslutningstakere',
    },
    passung: {
      text: 'Hva slags person lykkes hos dere på lang sikt — eller enklere sagt: hvem har ikke lykkes tidligere?',
      textFreelance: 'Hva gjør at en ekstern konsulent lykkes hos dere — og hva har noen allerede mislyktes med?',
      why: 'Beskriver personen det letes etter — og sparer dere for intervjuer som ikke kan føre fram.',
      chapter: 'Arbeidsmodell og kultur',
    },
    sourcing: {
      text: 'Hvilke selskaper kommer gode kandidater til denne rollen vanligvis fra?',
      why: 'Her leter headhunteren din først. Bare headhunteren ser dette, og først når søket for dere er i gang.',
      chapter: 'Sourcing',
    },
    usp: {
      text: 'Hva er unikt ved dere som bedrift, og hvilke fordeler har selve stillingen som kanskje bare en ekspert setter pris på — for eksempel ingen kalde salgshenvendelser i en salgsrolle?',
      textFreelance: 'Hva gjør prosjektet attraktivt — teknologien, referansen eller utsikten til videre oppdrag?',
      why: 'Argumentet rekruttereren bruker for å overbevise noen som ikke engang er på jakt.',
      chapter: 'Tilbud og historie (EVP)',
    },
    kultur: {
      text: 'Hvordan vil du beskrive bedriftskulturen deres?',
      textFreelance: 'Hvordan samarbeider man hos dere — hva bør en ekstern konsulent være forberedt på?',
      why: 'Rekruttereren må kunne beskrive den troverdig uten å nevne bedriften.',
      chapter: 'Arbeidsmodell og kultur',
    },
    foerderung: {
      text: 'Hvilke konkrete tiltak gjør dere for å utvikle medarbeidere, særlig når det gjelder lønnsutvikling og karrieremuligheter?',
      why: 'Uten svar framstår stillingen som en blindvei.',
      chapter: 'Tilbud og historie (EVP)',
    },
    vertrag: {
      text: 'Hvordan er arbeidsavtalen utformet? Er det punkter i den som er sensitive eller kan skremme bort kandidater?',
      textFreelance: 'Hvordan er oppdragsavtalen utformet? Finnes det klausuler som skremmer bort frilansere?',
      why: 'Bedre at rekruttereren vet det på forhånd enn at kandidaten trekker seg ved signering.',
      chapter: 'Tidsplan og kontrakt',
    },
    einwaende: {
      text: 'Hva ville en kandidat være kritisk til ved stillingen, og hva svarer du på det?',
      why: 'Den som kjenner innvendingene på forhånd, mister ikke kandidater først ved tilbudet.',
      chapter: 'Tidsplan og kontrakt',
    },
    branche: {
      text: 'Hva går bra i bransjen deres akkurat nå? Hvilke utfordringer står bransjen overfor nå?',
      why: 'Argumentet som gjør at rekruttereren i det hele tatt når fram til en fornøyd kandidat.',
      chapter: 'Tilbud og historie (EVP)',
    },
    pipeline: {
      text: 'Hvor mange kandidater har dere nå, eller har dere hatt, i prosessen? Har kandidater noen gang trukket seg i tilbudsfasen? Hvis ja, hvorfor?',
      why: 'Viser rekruttereren hvem konkurransen er, og hvilken innvending som må møtes på forhånd.',
      chapter: 'Risiko og ærlighet',
    },
  },
  slot: {
    company_headcount: {
      label: 'Ansatte',
    },
    company_size_band: {
      label: 'Størrelsesklasse',
    },
    salary_range: {
      label: 'Lønn fra / til (€)',
    },
    day_rate_range: {
      label: 'Budsjett per dag, alt inkludert (€)',
    },
    contract_duration_months: {
      label: 'Varighet (måneder)',
    },
    utilization_days_per_week: {
      label: 'Omfang (dager per uke)',
    },
    extension_possible: {
      label: 'Forlengelse mulig',
    },
    salary_months: {
      label: 'Hvor mange månedslønner utbetales per år?',
    },
    bonus_structure: {
      label: 'Er det bonus?',
    },
    bonus_basis: {
      label: 'Hva avhenger den av?',
    },
    salary_flex: {
      label: 'Hvor stort handlingsrom har dere på lønn for riktig kandidat?',
    },
    must_have_criteria: {
      label: 'De tre dere ikke klarer dere uten',
    },
    trainable_skills: {
      label: 'Hva kan læres opp?',
    },
    department_structure: {
      label: 'Avdelingens oppbygging',
    },
    team_size: {
      label: 'Teamstørrelse',
      placeholder: 'Antall personer',
    },
    remote_days: {
      label: 'Dager med hjemmekontor per uke',
      labelFreelance: 'Dager på fjernarbeid per uke',
    },
    contract_limitation: {
      label: 'Er ansettelsen fast?',
    },
    core_hours: {
      label: 'Kjernetid',
      labelFreelance: 'Tilstedeværelse',
    },
    core_hours_detail: {
      label: 'Fra når til når?',
      labelFreelance: 'Hvilke tider nøyaktig?',
      placeholder: 'f.eks. 09:00–15:00',
    },
    overtime_policy: {
      label: 'Overtid …',
    },
    time_tracking_method: {
      label: 'Hvordan registreres arbeidstiden hos dere?',
      labelFreelance: 'Hvordan dokumenteres arbeidet?',
    },
    works_council: {
      label: 'Ansattutvalg (Betriebsrat)',
    },
    works_council_meeting_schedule: {
      label: 'Når møtes det?',
    },
    contract_creation_days: {
      label: 'Fra ja til kontrakt (dager)',
      placeholder: 'f.eks. 7',
    },
    contract_sent_digitally: {
      label: 'Sendes den digitalt?',
    },
    visa_sponsorship: {
      label: 'Arbeidstillatelse eller visum',
    },
    nogo_companies: {
      label: 'Ikke hent kandidater fra',
      placeholder: 'Skriv inn firmanavn',
    },
    vacancy_reason: {
      label: 'Hvorfor ledig',
      labelFreelance: 'Hvorfor eksternt',
    },
    hiring_deadline: {
      label: 'Besatt innen',
    },
    negative_impact_if_unfilled: {
      label: 'Negative følger ved forsinkelse',
    },
    max_notice_period: {
      label: 'Hvor lang oppsigelsestid kan dere maksimalt vente på?',
    },
    daily_routine: {
      label: 'Arbeidshverdagen',
    },
    task_focus: {
      label: 'Hva er hovedvekten i stillingen?',
    },
    task_breakdown: {
      label: 'Hvordan fordeler oppgavene seg i prosent?',
    },
    reports_to: {
      label: 'Rapporterer til',
    },
    decision_makers: {
      label: 'Deltar også i den endelige beslutningen',
    },
    interview_process: {
      label: 'Utvelgelsesprosessen',
    },
    success_profile: {
      label: 'Lykkes på lang sikt',
      labelFreelance: 'Leverer hos oss',
    },
    failure_profile: {
      label: 'Lyktes ikke',
      labelFreelance: 'Fungerte ikke hos oss',
    },
    target_companies: {
      label: 'Gode kandidater kommer fra',
      placeholder: 'Skriv inn firmanavn',
    },
    unique_selling_points: {
      label: 'Det som er unikt ved bedriften',
      labelFreelance: 'Det som gjør prosjektet attraktivt',
    },
    position_advantages: {
      label: 'Fordeler ved stillingen som bare en ekspert setter pris på',
      labelFreelance: 'Det bare en fagperson setter pris på',
    },
    company_culture: {
      label: 'Bedriftskultur',
      labelFreelance: 'Samarbeidet i prosjektet',
    },
    career_path: {
      label: 'Konkrete tiltak',
    },
    career_example: {
      label: 'Gi meg gjerne et konkret eksempel på det!',
    },
    contract_sensitive_topics: {
      label: 'Sensitive punkter',
    },
    candidate_concerns: {
      label: 'Det som blir sett kritisk på',
      placeholder: 'Skriv inn et eget punkt',
    },
    candidate_concerns_answer: {
      label: 'Ditt svar på det',
      placeholder: 'f.eks. fleksitid uten kjernetid veier opp for oppmøtekravet',
    },
    industry_opportunities: {
      label: 'Det som går bra',
    },
    industry_challenges: {
      label: 'Utfordringer',
    },
    candidates_in_pipeline: {
      label: 'I prosessen nå',
    },
    candidates_dropped_reason: {
      label: 'Frafall i tilbudsfasen',
    },
  },
  chips: {
    company_size_band: {
      c0: 'inntil 50',
      c1: '50–250',
      c2: '250–1 000',
      c3: '1 000–5 000',
      c4: 'flere enn 5 000',
    },
    extension_possible: {
      c0: 'Ja',
      c1: 'Nei',
    },
    salary_months: {
      c0: '12',
      c1: '12 + feriepenger',
      c2: '13',
      c3: '13,5',
      c4: '14',
    },
    bonus_structure: {
      c0: 'Nei',
      c1: 'inntil 10 %',
      c2: 'inntil 20 %',
      c3: 'mer enn 20 %',
    },
    bonus_basis: {
      c0: 'Bedriftens resultat',
      c1: 'Personlige mål',
      c2: 'Teammål',
      c3: 'Omsetning',
    },
    salary_flex: {
      c0: 'Ingen, spennet er fast',
      c1: 'inntil 5 % over',
      c2: 'inntil 10 % over',
      c3: 'kan forhandles',
    },
    remote_days: {
      c0: '0',
      c1: '1',
      c2: '2',
      c3: '3',
      c4: '4',
      c5: '5',
      c6: 'fritt valg',
    },
    contract_limitation: {
      c0: 'Fast',
      c1: 'Midlertidig med mulighet for fast',
      c2: 'Midlertidig',
      c3: 'Prosjektansettelse',
    },
    core_hours: {
      c0: 'Fleksitid uten kjernetid',
      c1: 'Fleksitid med kjernetid',
      c2: 'Faste arbeidstider',
      c3: 'Tillitsbasert arbeidstid',
      c4: 'Skiftarbeid',
    },
    overtime_policy: {
      c0: 'avspaseres',
      c1: 'utbetales',
      c2: 'inkludert i lønnen',
      c3: 'forekommer knapt',
    },
    time_tracking_method: {
      c0: 'digitalt',
      c1: 'noteres selv',
      c2: 'Stemplingsur',
      c3: 'ikke i det hele tatt',
    },
    works_council: {
      c0: 'Ja',
      c1: 'Nei',
    },
    works_council_meeting_schedule: {
      c0: 'Ukentlig',
      c1: 'Annenhver uke',
      c2: 'Månedlig',
      c3: 'Ved behov',
    },
    contract_sent_digitally: {
      c0: 'Ja',
      c1: 'Nei',
    },
    visa_sponsorship: {
      c0: 'Arbeidstillatelse for Tyskland kreves',
      c1: 'Vi bistår med visum',
    },
    nogo_companies: {
      c0: 'Kundene våre',
      c1: 'Leverandørene våre',
      c2: 'Konsernselskaper',
      c3: 'Ingen begrensning',
    },
    vacancy_reason: {
      c0: 'Vekst / nyopprettet',
      c1: 'Erstatning',
      c2: 'Bytte av nåværende person',
      c3: 'Foreldrepermisjonsvikariat',
      c4: 'Etterfølger / pensjon',
    },
    hiring_deadline: {
      c0: 'Så snart som mulig',
      c1: 'Om 1–3 måneder',
      c2: 'Om 3–6 måneder',
      c3: 'Fleksibelt i tid',
    },
    negative_impact_if_unfilled: {
      c0: 'Arbeidet blir liggende på teamet',
      c1: 'Vi betaler for ekstern hjelp',
      c2: 'Prosjekter blir forsinket',
      c3: 'Teamet står uten ledelse',
      c4: 'Regnskapsavslutningene blir forsinket',
    },
    max_notice_period: {
      c0: '1 måned',
      c1: '3 måneder',
      c2: '6 måneder',
      c3: 'spiller ingen rolle',
    },
    daily_routine: {
      c0: 'Fast rutine om morgenen',
      c1: 'Veksler mellom prosjekt og daglig drift',
      c2: 'Mye avklaring i teamet',
      c3: 'Møter utenfor kontoret',
      c4: 'Driftsavbrudd styrer dagen',
    },
    task_focus: {
      c0: 'Operativ / hands-on',
      c1: 'Styrende / koordinerende',
      c2: 'Oppbyggende / endrende',
      c3: 'Ledende / utviklende',
    },
    task_breakdown: {
      c0: 'Overveiende operativt',
      c1: 'Overveiende styring',
      c2: 'Halvt prosjekt, halvt daglig drift',
      c3: 'En tredjedel avklaring',
    },
    reports_to: {
      c0: 'Daglig ledelse',
      c1: 'Divisjonsleder',
      c2: 'Avdelingsleder',
      c3: 'Teamleder',
    },
    decision_makers: {
      c0: 'Ingen — jeg bestemmer',
      c1: 'Daglig ledelse',
      c2: 'HR',
      c3: 'Fagavdelingen',
      c4: 'Teamet',
    },
    interview_process: {
      c0: 'Førstegangsintervju med HR',
      c1: 'Andregangsintervju med fagavdelingen',
      c2: 'Andregangsintervju med daglig ledelse',
      c3: 'Caseoppgave',
      c4: 'Prøvedag',
    },
    success_profile: {
      c0: 'Tar selv i et tak',
      c1: 'Kommer fra en mellomstor bedrift',
      c2: 'Jobber gjerne selvstendig',
      c3: 'Foretrekker korte beslutningsveier framfor prosess',
    },
    failure_profile: {
      c0: 'Venter på instrukser',
      c1: 'Kom fra et konsern og savnet støttefunksjoner',
      c2: 'For lite hands-on',
      c3: 'Passet ikke inn i teamet som person',
    },
    target_companies: {
      c0: 'Konkurrenter',
      c1: 'Konsulentselskaper',
      c2: 'Konsern i bransjen',
      c3: 'Mellomstore bedrifter i bransjen',
      c4: 'Underleverandører',
    },
    unique_selling_points: {
      c0: 'Eierledet, ingen investorer',
      c1: 'Eget produkt, egen produksjon',
      c2: 'Markedsleder i en nisje',
      c3: 'Kort vei til daglig ledelse',
      c4: 'Trygg arbeidsplass, lav turnover',
    },
    position_advantages: {
      c0: 'Fullt ansvar i stedet for en støtterolle',
      c1: 'Direkte linje til daglig ledelse',
      c2: 'Bygge opp i stedet for å forvalte',
      c3: 'Moderne systemer i bruk',
    },
    company_culture: {
      c0: 'Vi har en uformell tone',
      c1: 'Vi har en formell tone',
      c2: 'Korte beslutningsveier, lite avklaring',
      c3: 'Faste ansvarsområder, tydelige prosesser',
      c4: 'Familiært miljø, lav turnover',
    },
    career_path: {
      c0: 'Årlig medarbeidersamtale',
      c1: 'Lønnen fastsettes da, ikke på forespørsel',
      c2: 'Årlig budsjett for videreutdanning',
      c3: 'Faglig karrierevei mulig',
      c4: 'Lederkarriere mulig',
    },
    career_example: {
      c0: 'Noen har blitt forfremmet internt',
      c1: 'Noen har tatt over fagansvaret',
      c2: 'Noen har byttet område',
    },
    contract_sensitive_topics: {
      c0: 'Ingen av disse',
      c1: 'Konkurranseklausul',
      c2: 'Tilbakebetalingsklausul (videreutdanning)',
      c3: 'Taushetsplikt / NDA',
      c4: 'Beredskapsvakt',
      c5: 'Reiseplikt',
    },
    candidate_concerns: {
      c0: 'Krav om oppmøte',
      c1: 'Reisevei',
      c2: 'Lønn',
      c3: 'Ingen bonus',
      c4: 'Tilbakebetalingsklausul',
      c5: 'Reisevirksomhet',
    },
    industry_opportunities: {
      c0: 'Ordresituasjonen er god',
      c1: 'Investeringene tar seg opp',
      c2: 'Støtteordninger hjelper',
      c3: 'Vi tar markedsandeler',
    },
    industry_challenges: {
      c0: 'Det er vanskelig å finne fagfolk',
      c1: 'Leveringstidene er lange',
      c2: 'Prispresset øker',
      c3: 'Regelverket blir mer krevende',
    },
  },
  chipsFreelance: {
    core_hours: {
      c0: 'Kan disponeres fritt',
      c1: 'Faste møter, ellers fritt',
      c2: 'Kjernetid må overholdes',
      c3: 'Skift- eller vaktplan',
    },
    time_tracking_method: {
      c0: 'Digital timeliste',
      c1: 'Timeliste på papir',
      c2: 'Månedsrapport',
      c3: 'Ingen registrering',
    },
    vacancy_reason: {
      c0: 'Nytt prosjekt',
      c1: 'Arbeidstopp',
      c2: 'Dekke opp for fravær',
      c3: 'Kompetansen mangler internt',
      c4: 'Til stillingen er fast besatt',
    },
    negative_impact_if_unfilled: {
      c0: 'Fristen mot kunden står i fare',
      c1: 'Vi betaler dyrere for ekstern hjelp',
      c2: 'Prosjektet blir forsinket',
      c3: 'Anlegget settes i drift senere',
      c4: 'Interne folk tas ut av annet arbeid',
    },
    daily_routine: {
      c0: 'Fast plass i prosjektteamet',
      c1: 'Avklaring med fagavdelingen',
      c2: 'Selvstendig, lite avklaring',
      c3: 'På stedet ved anlegget',
    },
    reports_to: {
      c0: 'Prosjektledelsen',
      c1: 'Leder for fagavdelingen',
      c2: 'Divisjonsleder',
      c3: 'Daglig ledelse',
    },
    success_profile: {
      c0: 'Leverer fra dag én uten opplæring',
      c1: 'Får med seg fagavdelingene',
      c2: 'Dokumenterer for overleveringen',
      c3: 'Jobber selvstendig uten oppfølgingsspørsmål',
    },
    failure_profile: {
      c0: 'Brukte for lang tid på å bli produktiv',
      c1: 'Ga råd i stedet for å gjennomføre',
      c2: 'Etterlot ingen dokumentasjon',
      c3: 'Kom ikke til rette med prosessene våre',
    },
    unique_selling_points: {
      c0: 'Moderne teknologi i stedet for gamle systemer',
      c1: 'Et prosjekt som kan brukes som referanse',
      c2: 'Tydelig oppdrag, ingen politikk',
      c3: 'Utsikt til videre oppdrag',
    },
    position_advantages: {
      c0: 'Beslutninger uten runder i utvalg',
      c1: 'Tilgang til systemene fra dag én',
      c2: 'Et faglig godt oppsatt prosjekt',
      c3: 'Kontaktperson med beslutningsmyndighet',
    },
    company_culture: {
      c0: 'Korte beslutningsveier, lite avklaring',
      c1: 'Faste møter, tydelige ansvarsområder',
      c2: 'Konsernprosesser, mange involverte',
      c3: 'Vi har en formell tone',
      c4: 'Vi har en uformell tone',
    },
    contract_sensitive_topics: {
      c0: 'Ingen av disse',
      c1: 'Konkurranseklausul',
      c2: 'Ansvar / forsikringsbevis',
      c3: 'Taushetsplikt / NDA',
      c4: 'Krav om oppmøte uten unntak',
      c5: 'Reiseplikt',
    },
  },
  benefits: {
    c0: '30 feriedager',
    c1: 'Flere enn 30 feriedager',
    c2: 'Hjemmekontor mulig',
    c3: 'Fleksitid uten kjernetid',
    c4: 'Deltid mulig',
    c5: 'Workation / arbeid fra utlandet',
    c6: 'Permisjon (sabbatical)',
    c7: 'Bonus / premier',
    c8: 'Tjenestepensjon',
    c9: 'Arbeidsgivertilskudd til sparing',
    c10: 'Aksjeprogram for ansatte',
    c11: 'Flyttestøtte',
    c12: 'Firmasykkel / sykkelleasing',
    c13: 'Kollektivkort / reisetilskudd',
    c14: 'Firmabil',
    c15: 'Parkeringsplass eller ladestasjon',
    c16: 'Budsjett for videreutdanning',
    c17: 'Konferanser og sertifiseringer',
    c18: 'Coaching / mentorordning',
    c19: 'Lunsjtilskudd eller kantine',
    c20: 'Treningstilbud (Wellpass, Urban Sports)',
    c21: 'Helseoppfølging / bedriftslege',
    c22: 'Barnepass eller barnehagetilskudd',
    c23: 'Moderne utstyr, valgfri enhet',
    c24: 'Ansattrabatter',
  },
  benefitsContracting: {
    c0: 'Reisekostnader dekkes',
    c1: 'Overnatting ordnes',
    c2: 'Delvis fjernarbeid mulig',
    c3: 'Fleksible dager på stedet',
    c4: 'Ingen pliktig kjernetid',
    c5: 'Egen disponering av tiden',
    c6: 'Egen arbeidsplass',
    c7: 'Utstyr stilles til rådighet',
    c8: 'Parkeringsplass eller ladestasjon',
    c9: 'Tilgang til kantine',
    c10: 'Referanse lovet',
    c11: 'Videre oppdrag i sikte',
    c12: 'Tilgang til kurs og sertifiseringer',
  },
  benefitGroups: {
    c0: 'Tid og sted',
    c1: 'Penger',
    c2: 'Mobilitet',
    c3: 'Utvikling',
    c4: 'Hverdag',
  },
  benefitGroupsContracting: {
    c0: 'Vilkår',
    c1: 'Disponering',
    c2: 'På stedet',
    c3: 'Etter prosjektet',
  },
  value: {
    yes: 'Ja',
    no: 'Nei',
    given: 'oppgitt',
  },
};

export default nb;
