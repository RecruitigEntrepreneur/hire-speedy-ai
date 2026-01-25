-- =============================================
-- PHASE 1: FINANCE SKILL TAXONOMY ENTRIES
-- Erweitert die skill_taxonomy Tabelle mit Finance/Accounting Skills
-- =============================================

-- Buchhaltung Familie (mit allen Varianten als Aliases)
INSERT INTO skill_taxonomy (canonical_name, aliases, category, transferability_from)
VALUES 
  ('buchhaltung', 
   ARRAY['finanzbuchhaltung', 'lohnbuchhaltung', 'bilanzbuchhaltung', 'debitorenbuchhaltung', 
         'kreditorenbuchhaltung', 'anlagenbuchhaltung', 'buchhalter', 'buchführung', 'fibu', 
         'accounting', 'bookkeeping', 'buchhalterisch', 'finanzwesen'],
   'Finance',
   '{"rechnungswesen": 85, "controlling": 70, "steuerrecht": 60}'::jsonb),

  ('rechnungswesen',
   ARRAY['rechnungslegung', 'bilanzierung', 'jahresabschluss', 'monatsabschluss', 
         'quartalsabschluss', 'financial reporting', 'konsolidierung', 'abschluss', 
         'bilanz', 'guv', 'gewinn- und verlustrechnung'],
   'Finance',
   '{"buchhaltung": 85, "controlling": 75, "hgb": 80}'::jsonb),

  ('controlling',
   ARRAY['finanzcontrolling', 'kostenrechnung', 'budgetierung', 'controller', 
         'controllerin', 'financial controlling', 'kostencontrolling', 
         'betriebswirtschaft', 'bwl', 'kalkulation', 'deckungsbeitragsrechnung'],
   'Finance',
   '{"rechnungswesen": 75, "buchhaltung": 65, "sap co": 80}'::jsonb),

  ('hgb',
   ARRAY['handelsgesetzbuch', 'hgb bilanzierung', 'deutsche rechnungslegung', 
         'handelsrecht', 'deutsches handelsrecht'],
   'Finance',
   '{"ifrs": 70, "rechnungswesen": 85, "bilanzierung": 90}'::jsonb),

  ('ifrs',
   ARRAY['international financial reporting standards', 'ias', 'internationale rechnungslegung',
         'ifrs 16', 'ifrs 15', 'ifrs 9'],
   'Finance',
   '{"hgb": 70, "gaap": 80, "rechnungswesen": 80}'::jsonb),

  ('steuerrecht',
   ARRAY['steuererklärung', 'umsatzsteuer', 'ust', 'ust-va', 'einkommensteuer', 
         'körperschaftsteuer', 'gewerbesteuer', 'steuerfachangestellte', 'tax', 
         'steuerberater', 'steuern', 'steuerliche', 'abgabenordnung', 'ao'],
   'Finance',
   '{"buchhaltung": 70, "lohnbuchhaltung": 60}'::jsonb),

  ('datev',
   ARRAY['datev unternehmen online', 'datev buchhaltung', 'datev lohn', 
         'datev kanzlei-rechnungswesen', 'duo', 'datev comfort', 'datev pro'],
   'Finance Software',
   '{"lexware": 80, "sage": 80, "addison": 85, "navision": 60}'::jsonb),

  ('lexware',
   ARRAY['lexware buchhaltung', 'lexware financial office', 'lexware lohn', 
         'lexware warenwirtschaft', 'lexoffice'],
   'Finance Software',
   '{"datev": 75, "sage": 85}'::jsonb),

  ('sage',
   ARRAY['sage 50', 'sage 100', 'sage buchhaltung', 'sage hr', 'sage x3', 
         'sage one', 'sage business cloud'],
   'Finance Software',
   '{"datev": 75, "lexware": 85, "navision": 70}'::jsonb),

  ('sap fi',
   ARRAY['sap finance', 'sap finanzwesen', 'sap fi/co', 'sap fico', 
         's4 hana finance', 'sap financial accounting'],
   'Finance Software',
   '{"sap co": 90, "datev": 50, "buchhaltung": 70}'::jsonb),

  ('sap co',
   ARRAY['sap controlling', 'sap fi/co', 'sap fico', 's4 hana controlling', 
         'sap kostenrechnung'],
   'Finance Software',
   '{"sap fi": 90, "controlling": 75}'::jsonb),

  ('lohnbuchhaltung',
   ARRAY['lohnabrechnung', 'payroll', 'gehaltsabrechnung', 'entgeltabrechnung', 
         'lohn und gehalt', 'personalabrechnung', 'lohnbuchhalter', 'sv-meldungen',
         'sozialversicherung', 'lohnsteuer'],
   'Finance',
   '{"buchhaltung": 80, "hr": 60}'::jsonb),

  ('mahnwesen',
   ARRAY['forderungsmanagement', 'inkasso', 'debitorenmanagement', 'zahlungsverkehr',
         'offene posten', 'op-verwaltung', 'mahnverfahren', 'accounts receivable', 'ar'],
   'Finance',
   '{"buchhaltung": 85, "debitorenbuchhaltung": 95}'::jsonb),

  ('kreditorenbuchhaltung',
   ARRAY['accounts payable', 'ap', 'eingangsrechnungen', 'lieferantenrechnungen',
         'kreditorenmanagement', 'rechnungsprüfung'],
   'Finance',
   '{"buchhaltung": 95, "debitorenbuchhaltung": 85}'::jsonb),

  ('debitorenbuchhaltung',
   ARRAY['accounts receivable', 'ar', 'ausgangsrechnungen', 'kundenrechnungen',
         'debitorenmanagement', 'forderungsverwaltung'],
   'Finance',
   '{"buchhaltung": 95, "kreditorenbuchhaltung": 85}'::jsonb)

ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  transferability_from = EXCLUDED.transferability_from;

-- =============================================
-- PHASE 2: SKILL SYNONYMS ERWEITERUNG
-- Bidirektionale Synonyme für Finance-Skills
-- =============================================

INSERT INTO skill_synonyms (canonical_name, synonym, category, confidence, bidirectional) VALUES
-- Buchhaltung Familie (bidirektional = alle matchen untereinander)
('buchhaltung', 'finanzbuchhaltung', 'finance', 1.0, true),
('buchhaltung', 'lohnbuchhaltung', 'finance', 0.9, true),
('buchhaltung', 'bilanzbuchhaltung', 'finance', 1.0, true),
('buchhaltung', 'debitorenbuchhaltung', 'finance', 0.95, true),
('buchhaltung', 'kreditorenbuchhaltung', 'finance', 0.95, true),
('buchhaltung', 'anlagenbuchhaltung', 'finance', 0.95, true),
('buchhaltung', 'buchhalter', 'finance', 1.0, true),
('buchhaltung', 'buchführung', 'finance', 1.0, true),
('buchhaltung', 'fibu', 'finance', 1.0, true),
('buchhaltung', 'finanzwesen', 'finance', 0.9, true),
('buchhaltung', 'accounting', 'finance', 1.0, true),
('buchhaltung', 'bookkeeping', 'finance', 1.0, true),

-- Rechnungswesen Familie
('rechnungswesen', 'rechnungslegung', 'finance', 1.0, true),
('rechnungswesen', 'bilanzierung', 'finance', 1.0, true),
('rechnungswesen', 'jahresabschluss', 'finance', 0.95, true),
('rechnungswesen', 'monatsabschluss', 'finance', 0.95, true),
('rechnungswesen', 'quartalsabschluss', 'finance', 0.95, true),
('rechnungswesen', 'financial reporting', 'finance', 0.95, true),
('rechnungswesen', 'abschluss', 'finance', 0.9, true),
('rechnungswesen', 'bilanz', 'finance', 0.9, true),
('rechnungswesen', 'guv', 'finance', 0.9, true),

-- HGB/IFRS Familie
('hgb', 'handelsgesetzbuch', 'finance', 1.0, true),
('hgb', 'deutsche rechnungslegung', 'finance', 0.95, true),
('ifrs', 'international financial reporting standards', 'finance', 1.0, true),
('ifrs', 'ias', 'finance', 0.9, true),
('hgb', 'ifrs', 'finance', 0.7, true),

-- Controlling Familie
('controlling', 'finanzcontrolling', 'finance', 1.0, true),
('controlling', 'controller', 'finance', 1.0, true),
('controlling', 'controllerin', 'finance', 1.0, true),
('controlling', 'kostenrechnung', 'finance', 0.9, true),
('controlling', 'budgetierung', 'finance', 0.9, true),
('controlling', 'kalkulation', 'finance', 0.85, true),

-- Steuerrecht Familie
('steuerrecht', 'steuererklärung', 'finance', 0.9, true),
('steuerrecht', 'umsatzsteuer', 'finance', 0.9, true),
('steuerrecht', 'steuerfachangestellte', 'finance', 0.95, true),
('steuerrecht', 'steuerberater', 'finance', 0.95, true),
('steuerrecht', 'steuern', 'finance', 0.9, true),

-- Lohnbuchhaltung Familie
('lohnbuchhaltung', 'lohnabrechnung', 'finance', 1.0, true),
('lohnbuchhaltung', 'payroll', 'finance', 1.0, true),
('lohnbuchhaltung', 'gehaltsabrechnung', 'finance', 1.0, true),
('lohnbuchhaltung', 'entgeltabrechnung', 'finance', 1.0, true),
('lohnbuchhaltung', 'personalabrechnung', 'finance', 0.95, true),

-- Software Synonyme
('datev', 'datev unternehmen online', 'finance', 1.0, true),
('datev', 'duo', 'finance', 1.0, true),
('lexware', 'lexware buchhaltung', 'finance', 1.0, true),
('lexware', 'lexoffice', 'finance', 0.9, true),
('sage', 'sage 50', 'finance', 1.0, true),
('sage', 'sage 100', 'finance', 1.0, true),

-- SAP Finance
('sap fi', 'sap finance', 'finance', 1.0, true),
('sap fi', 'sap finanzwesen', 'finance', 1.0, true),
('sap fi', 'sap fico', 'finance', 0.95, true),
('sap co', 'sap controlling', 'finance', 1.0, true),

-- Mahnwesen / Forderungsmanagement
('mahnwesen', 'forderungsmanagement', 'finance', 1.0, true),
('mahnwesen', 'inkasso', 'finance', 0.9, true),
('mahnwesen', 'debitorenmanagement', 'finance', 0.95, true),

-- Debitoren/Kreditoren
('debitorenbuchhaltung', 'accounts receivable', 'finance', 1.0, true),
('debitorenbuchhaltung', 'ar', 'finance', 1.0, true),
('kreditorenbuchhaltung', 'accounts payable', 'finance', 1.0, true),
('kreditorenbuchhaltung', 'ap', 'finance', 1.0, true),

-- Kreuzverknüpfungen Buchhaltung <-> Rechnungswesen
('buchhaltung', 'rechnungswesen', 'finance', 0.85, true)

ON CONFLICT DO NOTHING;