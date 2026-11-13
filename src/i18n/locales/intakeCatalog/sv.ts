import type de from './de';
import type { Messages } from '../../types';

// Svenska. Tilltal: du.
const sv: Messages<typeof de> = {
  q: {
    firmengroesse: {
      text: 'Hur många anställda har ni i dag?',
      why: 'Kandidaten frågar om det i första samtalet, och rekryteraren behöver det när kandidater kontaktas.',
      chapter: 'Företag',
    },
    verguetung: {
      text: 'Inom vilket intervall ligger den fasta lönen?',
      why: 'Utan ett löneintervall kan ingen rekryterare kontakta kandidater — det är varje kandidats första fråga.',
      chapter: 'Ersättning',
    },
    kriterien: {
      text: 'Vilka 3 kriterier måste kandidaten uppfylla för att ni ska kunna sätta personen i arbete direkt och absolut vilja träffa hen?',
      kurz: 'Hur hårt är vart och ett av kriterierna?',
      intro: 'Utifrån det vi just har gått igenom om arbetsvardagen och utmaningarna:',
      why: 'Gör en önskelista till en tydlig sökprofil. Allt annat är förhandlingsbart.',
      chapter: 'Kompetenser',
    },
    team: {
      text: 'Hur är avdelningen kring tjänsten uppbyggd?',
      textFreelance: 'Hur ser projektteamet ut, och vilka fler externa arbetar i det?',
      why: 'En roll där man står ensam kräver en annan person än en roll i ett team på 15.',
      chapter: 'Grunduppgifter',
    },
    arbeitszeit: {
      text: 'Hur ser arbetstiderna (fasta närvarotider) ut hos er? Hur hanterar ni distansarbete och övertid?',
      textFreelance: 'Hur fritt lägger personen upp sin tid — och hur redovisas arbetet?',
      why: 'Den vanligaste orsaken till att kandidater tackar nej på slutet — de frågar tidigt om det.',
      chapter: 'Arbetstid & process',
    },
    gremien: {
      text: 'Finns det en facklig arbetstagarrepresentation (tyskt Betriebsrat) hos er? (Om ja, när sammanträder den?)',
      why: 'Påverkar tiden fram till ett erbjudande mer än något annat steg i processen.',
      chapter: 'Arbetstid & process',
    },
    vertragstempo: {
      text: 'Hur lång tid tar det för er att ta fram avtalet? (Skickas det digitalt?)',
      why: 'Mellan muntligt besked och avtal tappar man kandidater till snabbare konkurrenter.',
      chapter: 'Arbetstid & process',
    },
    arbeitserlaubnis: {
      text: 'Behöver kandidaten ha arbetstillstånd, eller hjälper ni till med visum?',
      why: 'Ett avgörande kriterium: utan svaret kontaktar rekryteraren kandidater som inte får börja.',
      chapter: 'Arbetstid & process',
    },
    abwerbeschutz: {
      text: 'Vilka företag får vi under inga omständigheter rekrytera från?',
      why: 'Den som rekryterar från kundens kund skadar affärsrelationen. Bara rekryteraren ser detta, och först när sökningen pågår.',
      chapter: 'Arbetstid & process',
    },
    vakanz: {
      text: 'Varför är tjänsten vakant? När måste den vara tillsatt, och vilka negativa följder kan det få om den står tom längre?',
      textFreelance: 'Varför behöver ni extern kapacitet? Från när — och vad händer om ingen finns på plats?',
      why: 'Avgör berättelsen, brådskan och risken — och står aldrig i någon annons.',
      chapter: 'Tidplan & avtal',
    },
    alltag: {
      text: 'Kan du beskriva hur kandidatens arbetsvardag ser ut?',
      why: 'Rekryteraren berättar om den här vardagen i samtalet med kandidaten. Utan den förblir rollen abstrakt.',
      chapter: 'Roll & omfattning',
    },
    entscheidung: {
      text: 'Vem rapporterar kandidaten till, och är någon mer än du med i det slutliga beslutet?',
      why: 'Den som vet det kan rikta argumenten mot rätt person.',
      chapter: 'Process & beslutsfattare',
    },
    auswahlprozess: {
      text: 'Hur går er urvalsprocess till: hur många intervjuer, med vem, finns det ett case eller en provdag?',
      why: 'Kandidater frågar om det i första samtalet. Den som känner till upplägget hoppar mer sällan av.',
      chapter: 'Process & beslutsfattare',
    },
    passung: {
      text: 'Vilken sorts person lyckas hos er på lång sikt — eller enklare uttryckt: vem har inte lyckats tidigare?',
      textFreelance: 'Vad gör att en extern konsult lyckas hos er — och vad har någon redan gått bet på?',
      why: 'Beskriver personen som söks — och besparar er intervjuer som inte kan leda någonstans.',
      chapter: 'Arbetsmodell & kultur',
    },
    sourcing: {
      text: 'Från vilka företag brukar bra kandidater för den här rollen komma?',
      why: 'Här letar din headhunter först. Bara headhuntern ser detta, och först när sökningen för er pågår.',
      chapter: 'Sourcing',
    },
    usp: {
      text: 'Vad är unikt med er som företag, och vilka fördelar har själva tjänsten som kanske bara en expert uppskattar — till exempel ingen kall kundbearbetning i en säljroll?',
      textFreelance: 'Vad gör projektet attraktivt — tekniken, referensen eller utsikten till fortsatta uppdrag?',
      why: 'Argumentet som rekryteraren använder för att övertyga någon som inte ens söker.',
      chapter: 'Erbjudande & berättelse (EVP)',
    },
    kultur: {
      text: 'Hur skulle du beskriva er företagskultur?',
      textFreelance: 'Hur samarbetar man hos er — vad bör en extern konsult vara beredd på?',
      why: 'Rekryteraren måste kunna beskriva den trovärdigt utan att nämna företaget.',
      chapter: 'Arbetsmodell & kultur',
    },
    foerderung: {
      text: 'Vilka konkreta åtgärder gör ni för att utveckla medarbetare, särskilt när det gäller löneutveckling och karriärmöjligheter?',
      why: 'Utan svar ser tjänsten ut som en återvändsgränd.',
      chapter: 'Erbjudande & berättelse (EVP)',
    },
    vertrag: {
      text: 'Hur är anställningsavtalet utformat? Finns det punkter i det som är känsliga eller kan avskräcka kandidater?',
      textFreelance: 'Hur är uppdragsavtalet utformat? Finns det klausuler som avskräcker frilansare?',
      why: 'Bättre att rekryteraren vet det i förväg än att kandidaten hoppar av vid signeringen.',
      chapter: 'Tidplan & avtal',
    },
    einwaende: {
      text: 'Vad skulle en kandidat se kritiskt på i tjänsten, och vad svarar du på det?',
      why: 'Den som känner till invändningarna i förväg tappar inte kandidater först vid erbjudandet.',
      chapter: 'Tidplan & avtal',
    },
    branche: {
      text: 'Vad går bra i er bransch just nu? Vilka utmaningar står branschen inför just nu?',
      why: 'Argumentet som gör att rekryteraren över huvud taget når fram till en nöjd kandidat.',
      chapter: 'Erbjudande & berättelse (EVP)',
    },
    pipeline: {
      text: 'Hur många kandidater har ni just nu, eller har ni haft, i processen? Har kandidater någon gång hoppat av i erbjudandeskedet? Om ja, varför?',
      why: 'Visar rekryteraren vem konkurrensen är och vilken invändning som behöver bemötas i förväg.',
      chapter: 'Risker & ärlighet',
    },
  },
  slot: {
    company_headcount: {
      label: 'Anställda',
    },
    company_size_band: {
      label: 'Storleksklass',
    },
    salary_range: {
      label: 'Lön från / till (€)',
    },
    day_rate_range: {
      label: 'Budget per dag, allt inkluderat (€)',
    },
    contract_duration_months: {
      label: 'Löptid (månader)',
    },
    utilization_days_per_week: {
      label: 'Omfattning (dagar per vecka)',
    },
    extension_possible: {
      label: 'Förlängning möjlig',
    },
    salary_months: {
      label: 'Hur många månadslöner betalas per år?',
    },
    bonus_structure: {
      label: 'Finns det bonus?',
    },
    bonus_basis: {
      label: 'Vad beror den på?',
    },
    salary_flex: {
      label: 'Hur stort utrymme har ni i lönen för rätt kandidat?',
    },
    must_have_criteria: {
      label: 'De tre som ni inte klarar er utan',
    },
    trainable_skills: {
      label: 'Vad går att lära upp?',
    },
    department_structure: {
      label: 'Avdelningens uppbyggnad',
    },
    team_size: {
      label: 'Teamstorlek',
      placeholder: 'Antal personer',
    },
    remote_days: {
      label: 'Distansdagar per vecka',
      labelFreelance: 'Dagar på distans per vecka',
    },
    contract_limitation: {
      label: 'Är anställningen tillsvidare?',
    },
    core_hours: {
      label: 'Fast närvarotid',
      labelFreelance: 'Närvaro',
    },
    core_hours_detail: {
      label: 'Från när till när?',
      labelFreelance: 'Vilka tider exakt?',
      placeholder: 't.ex. 09:00–15:00',
    },
    overtime_policy: {
      label: 'Övertid …',
    },
    time_tracking_method: {
      label: 'Hur registreras arbetstiden hos er?',
      labelFreelance: 'Hur redovisas arbetet?',
    },
    works_council: {
      label: 'Arbetstagarrepresentation (Betriebsrat)',
    },
    works_council_meeting_schedule: {
      label: 'När sammanträder den?',
    },
    contract_creation_days: {
      label: 'Från ja till avtal (dagar)',
      placeholder: 't.ex. 7',
    },
    contract_sent_digitally: {
      label: 'Skickas det digitalt?',
    },
    visa_sponsorship: {
      label: 'Arbetstillstånd eller visum',
    },
    nogo_companies: {
      label: 'Rekrytera inte från',
      placeholder: 'Ange företagsnamn',
    },
    vacancy_reason: {
      label: 'Varför vakant',
      labelFreelance: 'Varför externt',
    },
    hiring_deadline: {
      label: 'Tillsatt senast',
    },
    negative_impact_if_unfilled: {
      label: 'Negativa följder vid försening',
    },
    max_notice_period: {
      label: 'Hur lång uppsägningstid kan ni som längst vänta på?',
    },
    daily_routine: {
      label: 'Arbetsvardagen',
    },
    task_focus: {
      label: 'Vad är tjänstens tyngdpunkt?',
    },
    task_breakdown: {
      label: 'Hur fördelas arbetsuppgifterna i procent?',
    },
    reports_to: {
      label: 'Rapporterar till',
    },
    decision_makers: {
      label: 'Deltar också i det slutliga beslutet',
    },
    interview_process: {
      label: 'Urvalsprocessen',
    },
    success_profile: {
      label: 'Lyckas på lång sikt',
      labelFreelance: 'Levererar hos oss',
    },
    failure_profile: {
      label: 'Lyckades inte',
      labelFreelance: 'Fungerade inte hos oss',
    },
    target_companies: {
      label: 'Bra kandidater kommer från',
      placeholder: 'Ange företagsnamn',
    },
    unique_selling_points: {
      label: 'Det som är unikt med företaget',
      labelFreelance: 'Det som gör projektet attraktivt',
    },
    position_advantages: {
      label: 'Fördelar med tjänsten som bara en expert uppskattar',
      labelFreelance: 'Det som bara en specialist uppskattar',
    },
    company_culture: {
      label: 'Företagskultur',
      labelFreelance: 'Samarbetet i projektet',
    },
    career_path: {
      label: 'Konkreta åtgärder',
    },
    career_example: {
      label: 'Ge mig gärna ett konkret exempel på det!',
    },
    contract_sensitive_topics: {
      label: 'Känsliga punkter',
    },
    candidate_concerns: {
      label: 'Det som ses kritiskt',
      placeholder: 'Ange en egen punkt',
    },
    candidate_concerns_answer: {
      label: 'Ditt svar på det',
      placeholder: 't.ex. flextid utan fasta närvarotider väger upp närvarokravet',
    },
    industry_opportunities: {
      label: 'Det som går bra',
    },
    industry_challenges: {
      label: 'Utmaningar',
    },
    candidates_in_pipeline: {
      label: 'I processen just nu',
    },
    candidates_dropped_reason: {
      label: 'Avhopp i erbjudandeskedet',
    },
  },
  chips: {
    company_size_band: {
      c0: 'upp till 50',
      c1: '50–250',
      c2: '250–1 000',
      c3: '1 000–5 000',
      c4: 'fler än 5 000',
    },
    extension_possible: {
      c0: 'Ja',
      c1: 'Nej',
    },
    salary_months: {
      c0: '12',
      c1: '12 + semesterersättning',
      c2: '13',
      c3: '13,5',
      c4: '14',
    },
    bonus_structure: {
      c0: 'Nej',
      c1: 'upp till 10 %',
      c2: 'upp till 20 %',
      c3: 'mer än 20 %',
    },
    bonus_basis: {
      c0: 'Företagets resultat',
      c1: 'Personliga mål',
      c2: 'Teammål',
      c3: 'Omsättning',
    },
    salary_flex: {
      c0: 'Inget, intervallet är fast',
      c1: 'upp till 5 % över',
      c2: 'upp till 10 % över',
      c3: 'förhandlingsbart',
    },
    remote_days: {
      c0: '0',
      c1: '1',
      c2: '2',
      c3: '3',
      c4: '4',
      c5: '5',
      c6: 'valfritt',
    },
    contract_limitation: {
      c0: 'Tillsvidare',
      c1: 'Tidsbegränsad med möjlighet till tillsvidare',
      c2: 'Tidsbegränsad',
      c3: 'Projektanställning',
    },
    core_hours: {
      c0: 'Flextid utan fasta närvarotider',
      c1: 'Flextid med fasta närvarotider',
      c2: 'Fasta arbetstider',
      c3: 'Förtroendearbetstid',
      c4: 'Skiftarbete',
    },
    overtime_policy: {
      c0: 'kompenseras med ledighet',
      c1: 'betalas ut',
      c2: 'ingår i lönen',
      c3: 'förekommer knappt',
    },
    time_tracking_method: {
      c0: 'digitalt',
      c1: 'antecknas själv',
      c2: 'Stämpelklocka',
      c3: 'inte alls',
    },
    works_council: {
      c0: 'Ja',
      c1: 'Nej',
    },
    works_council_meeting_schedule: {
      c0: 'Varje vecka',
      c1: 'Varannan vecka',
      c2: 'Varje månad',
      c3: 'Vid behov',
    },
    contract_sent_digitally: {
      c0: 'Ja',
      c1: 'Nej',
    },
    visa_sponsorship: {
      c0: 'Arbetstillstånd för Tyskland krävs',
      c1: 'Vi hjälper till med visum',
    },
    nogo_companies: {
      c0: 'Våra kunder',
      c1: 'Våra leverantörer',
      c2: 'Koncernbolag',
      c3: 'Ingen begränsning',
    },
    vacancy_reason: {
      c0: 'Tillväxt / nyinrättad',
      c1: 'Ersättningsrekrytering',
      c2: 'Byte av nuvarande person',
      c3: 'Föräldraledighetsvikariat',
      c4: 'Efterträdare / pension',
    },
    hiring_deadline: {
      c0: 'Så snart som möjligt',
      c1: 'Inom 1–3 månader',
      c2: 'Inom 3–6 månader',
      c3: 'Flexibelt i tid',
    },
    negative_impact_if_unfilled: {
      c0: 'Arbetet hamnar på teamet',
      c1: 'Vi betalar för extern hjälp',
      c2: 'Projekt försenas',
      c3: 'Teamet står utan ledning',
      c4: 'Boksluten blir försenade',
    },
    max_notice_period: {
      c0: '1 månad',
      c1: '3 månader',
      c2: '6 månader',
      c3: 'spelar ingen roll',
    },
    daily_routine: {
      c0: 'Fast rutin på morgonen',
      c1: 'Växlar mellan projekt och löpande verksamhet',
      c2: 'Mycket avstämning i teamet',
      c3: 'Möten utanför kontoret',
      c4: 'Störningar styr dagen',
    },
    task_focus: {
      c0: 'Operativ / hands-on',
      c1: 'Styrande / koordinerande',
      c2: 'Uppbyggande / förändrande',
      c3: 'Ledande / utvecklande',
    },
    task_breakdown: {
      c0: 'Övervägande operativt',
      c1: 'Övervägande styrning',
      c2: 'Hälften projekt, hälften löpande verksamhet',
      c3: 'En tredjedel avstämning',
    },
    reports_to: {
      c0: 'Företagsledningen',
      c1: 'Affärsområdeschef',
      c2: 'Avdelningschef',
      c3: 'Teamledare',
    },
    decision_makers: {
      c0: 'Ingen — jag beslutar',
      c1: 'Företagsledningen',
      c2: 'HR',
      c3: 'Verksamheten',
      c4: 'Teamet',
    },
    interview_process: {
      c0: 'Första intervju med HR',
      c1: 'Andra intervju med verksamheten',
      c2: 'Andra intervju med företagsledningen',
      c3: 'Case',
      c4: 'Provdag',
    },
    success_profile: {
      c0: 'Hugger själv i',
      c1: 'Kommer från ett medelstort företag',
      c2: 'Arbetar gärna under eget ansvar',
      c3: 'Föredrar korta beslutsvägar framför process',
    },
    failure_profile: {
      c0: 'Väntar på instruktioner',
      c1: 'Kom från en koncern och saknade stödfunktioner',
      c2: 'För lite hands-on',
      c3: 'Passade inte in i teamet som person',
    },
    target_companies: {
      c0: 'Konkurrenter',
      c1: 'Konsultbolag',
      c2: 'Koncerner i branschen',
      c3: 'Medelstora företag i branschen',
      c4: 'Underleverantörer',
    },
    unique_selling_points: {
      c0: 'Ägarlett, inga investerare',
      c1: 'Egen produkt, egen tillverkning',
      c2: 'Marknadsledande i en nisch',
      c3: 'Korta vägar till företagsledningen',
      c4: 'Trygg anställning, låg personalomsättning',
    },
    position_advantages: {
      c0: 'Fullt ansvar i stället för en stödjande roll',
      c1: 'Direktkontakt med företagsledningen',
      c2: 'Bygga upp i stället för att förvalta',
      c3: 'Moderna system i drift',
    },
    company_culture: {
      c0: 'Vi har en informell ton',
      c1: 'Vi har en formell ton',
      c2: 'Korta beslutsvägar, lite avstämning',
      c3: 'Fasta ansvarsområden, tydliga processer',
      c4: 'Familjär stämning, låg personalomsättning',
    },
    career_path: {
      c0: 'Årligt utvecklingssamtal',
      c1: 'Lönen sätts då, inte på förfrågan',
      c2: 'Årlig utbildningsbudget',
      c3: 'Specialistkarriär möjlig',
      c4: 'Chefskarriär möjlig',
    },
    career_example: {
      c0: 'Någon har befordrats internt',
      c1: 'Någon har tagit över fackansvaret',
      c2: 'Någon har bytt område',
    },
    contract_sensitive_topics: {
      c0: 'Inget av detta',
      c1: 'Konkurrensklausul',
      c2: 'Återbetalningsklausul (utbildning)',
      c3: 'Sekretess / NDA',
      c4: 'Beredskap',
      c5: 'Resor krävs',
    },
    candidate_concerns: {
      c0: 'Krav på närvaro på plats',
      c1: 'Resväg till arbetet',
      c2: 'Lön',
      c3: 'Ingen bonus',
      c4: 'Återbetalningsklausul',
      c5: 'Resor i tjänsten',
    },
    industry_opportunities: {
      c0: 'Orderläget är gott',
      c1: 'Investeringarna tar fart',
      c2: 'Stödprogram hjälper till',
      c3: 'Vi tar marknadsandelar',
    },
    industry_challenges: {
      c0: 'Kompetent personal är svår att hitta',
      c1: 'Leveranstiderna är långa',
      c2: 'Prispressen ökar',
      c3: 'Regelverket blir mer krävande',
    },
  },
  chipsFreelance: {
    core_hours: {
      c0: 'Kan läggas upp fritt',
      c1: 'Fasta möten, i övrigt fritt',
      c2: 'Fasta närvarotider ska hållas',
      c3: 'Skift- eller tjänstgöringsschema',
    },
    time_tracking_method: {
      c0: 'Digital tidrapport',
      c1: 'Tidrapport på papper',
      c2: 'Månadsrapport',
      c3: 'Ingen registrering',
    },
    vacancy_reason: {
      c0: 'Nytt projekt',
      c1: 'Arbetstopp',
      c2: 'Täcka upp för frånvaro',
      c3: 'Kompetensen saknas internt',
      c4: 'Tills tjänsten är fast tillsatt',
    },
    negative_impact_if_unfilled: {
      c0: 'Tidsplanen mot kunden är i fara',
      c1: 'Vi betalar dyrare för extern hjälp',
      c2: 'Projektet försenas',
      c3: 'Anläggningen tas i drift senare',
      c4: 'Intern personal tas från annat arbete',
    },
    daily_routine: {
      c0: 'Fast plats i projektteamet',
      c1: 'Avstämning med verksamheten',
      c2: 'Självständigt, lite avstämning',
      c3: 'På plats vid anläggningen',
    },
    reports_to: {
      c0: 'Projektledningen',
      c1: 'Verksamhetschef',
      c2: 'Affärsområdeschef',
      c3: 'Företagsledningen',
    },
    success_profile: {
      c0: 'Levererar från dag ett utan inskolning',
      c1: 'Får med sig verksamheten',
      c2: 'Dokumenterar inför överlämningen',
      c3: 'Arbetar självständigt utan följdfrågor',
    },
    failure_profile: {
      c0: 'Tog för lång tid att bli produktiv',
      c1: 'Gav råd i stället för att genomföra',
      c2: 'Lämnade ingen dokumentation efter sig',
      c3: 'Klarade inte av våra processer',
    },
    unique_selling_points: {
      c0: 'Modern teknik i stället för gamla system',
      c1: 'Ett projekt som fungerar som referens',
      c2: 'Tydligt uppdrag, ingen politik',
      c3: 'Utsikt till fortsatta uppdrag',
    },
    position_advantages: {
      c0: 'Beslut utan omvägar via kommittéer',
      c1: 'Tillgång till systemen från dag ett',
      c2: 'Ett fackmässigt väl upplagt projekt',
      c3: 'Kontaktperson med beslutsmandat',
    },
    company_culture: {
      c0: 'Korta beslutsvägar, lite avstämning',
      c1: 'Fasta möten, tydliga ansvarsområden',
      c2: 'Koncernprocesser, många inblandade',
      c3: 'Vi har en formell ton',
      c4: 'Vi har en informell ton',
    },
    contract_sensitive_topics: {
      c0: 'Inget av detta',
      c1: 'Konkurrensklausul',
      c2: 'Ansvar / försäkringsbevis',
      c3: 'Sekretess / NDA',
      c4: 'Krav på närvaro på plats utan undantag',
      c5: 'Resor krävs',
    },
  },
  benefits: {
    c0: '30 semesterdagar',
    c1: 'Fler än 30 semesterdagar',
    c2: 'Distansarbete möjligt',
    c3: 'Flextid utan fasta närvarotider',
    c4: 'Deltid möjlig',
    c5: 'Workation / arbete från utlandet',
    c6: 'Tjänstledighet (sabbatical)',
    c7: 'Bonus / premier',
    c8: 'Tjänstepension',
    c9: 'Arbetsgivarbidrag till sparande',
    c10: 'Delägarprogram för anställda',
    c11: 'Flytthjälp',
    c12: 'Förmånscykel / cykelleasing',
    c13: 'Kollektivtrafikkort / resebidrag',
    c14: 'Tjänstebil',
    c15: 'Parkeringsplats eller laddstolpe',
    c16: 'Utbildningsbudget',
    c17: 'Konferenser och certifieringar',
    c18: 'Coachning / mentorskap',
    c19: 'Lunchförmån eller personalmatsal',
    c20: 'Friskvård (Wellpass, Urban Sports)',
    c21: 'Hälsovård / företagsläkare',
    c22: 'Barnomsorg eller förskolebidrag',
    c23: 'Modern hårdvara, valfri utrustning',
    c24: 'Personalrabatter',
  },
  benefitsContracting: {
    c0: 'Resekostnader ersätts',
    c1: 'Boende ordnas',
    c2: 'Delvis distans möjligt',
    c3: 'Flexibla dagar på plats',
    c4: 'Inga fasta närvarotider',
    c5: 'Egen tidsplanering',
    c6: 'Egen arbetsplats',
    c7: 'Hårdvara tillhandahålls',
    c8: 'Parkeringsplats eller laddstolpe',
    c9: 'Tillgång till personalmatsal',
    c10: 'Referens utlovad',
    c11: 'Fortsatta uppdrag i sikte',
    c12: 'Tillgång till utbildningar och certifieringar',
  },
  benefitGroups: {
    c0: 'Tid & plats',
    c1: 'Pengar',
    c2: 'Mobilitet',
    c3: 'Utveckling',
    c4: 'Vardag',
  },
  benefitGroupsContracting: {
    c0: 'Villkor',
    c1: 'Upplägg',
    c2: 'På plats',
    c3: 'Efter projektet',
  },
  value: {
    yes: 'Ja',
    no: 'Nej',
    given: 'angivet',
  },
};

export default sv;
