-- Erweitere skill_taxonomy mit Hardware/Embedded, PM, Design und Business Skills
-- Diese Skills ermöglichen die korrekte Domain-Erkennung für das Tech-Domain-Gating

-- Hardware/Embedded Domain
INSERT INTO skill_taxonomy (canonical_name, category, aliases, related_skills, transferability_from)
VALUES 
  ('FPGA', 'Hardware', ARRAY['Field Programmable Gate Array', 'FPGA Design'], ARRAY['VHDL', 'Verilog', 'Xilinx', 'Altera', 'Intel FPGA'], '{"Digital Design": 80}'::jsonb),
  ('VHDL', 'Hardware', ARRAY['VHSIC Hardware Description Language', 'VHDL Programming'], ARRAY['FPGA', 'Verilog', 'Digital Design', 'ASIC'], '{"Verilog": 90}'::jsonb),
  ('Verilog', 'Hardware', ARRAY['Verilog HDL', 'SystemVerilog'], ARRAY['FPGA', 'VHDL', 'Digital Design', 'ASIC'], '{"VHDL": 90}'::jsonb),
  ('Embedded Systems', 'Hardware', ARRAY['Embedded', 'Embedded Software', 'Embedded Development', 'Embedded C'], ARRAY['C', 'C++', 'RTOS', 'Microcontroller', 'ARM'], '{"C": 70, "C++": 60}'::jsonb),
  ('PCB Design', 'Hardware', ARRAY['PCB', 'Leiterplattendesign', 'Circuit Board Design'], ARRAY['Altium', 'Cadence', 'Eagle', 'KiCad', 'Electronics'], NULL),
  ('Microcontroller', 'Hardware', ARRAY['MCU', 'Mikrokontroller', 'Embedded Microcontroller'], ARRAY['ARM', 'Arduino', 'STM32', 'PIC', 'AVR'], '{"Embedded Systems": 80}'::jsonb),
  ('ARM', 'Hardware', ARRAY['ARM Architecture', 'ARM Cortex', 'ARM Processor'], ARRAY['Microcontroller', 'Embedded Systems', 'C'], NULL),
  ('RTOS', 'Hardware', ARRAY['Real-Time Operating System', 'FreeRTOS', 'VxWorks'], ARRAY['Embedded Systems', 'C', 'C++'], NULL),
  ('SPS/PLC', 'Industrial Automation', ARRAY['SPS', 'PLC', 'Speicherprogrammierbare Steuerung', 'Programmable Logic Controller'], ARRAY['TIA Portal', 'TwinCAT', 'Siemens', 'Beckhoff', 'Industrial Automation'], NULL),
  ('TIA Portal', 'Industrial Automation', ARRAY['Siemens TIA', 'TIA Portal V17', 'Siemens Step 7'], ARRAY['SPS/PLC', 'Siemens', 'Industrial Automation'], NULL),
  ('TwinCAT', 'Industrial Automation', ARRAY['Beckhoff TwinCAT', 'TwinCAT 3'], ARRAY['SPS/PLC', 'Beckhoff', 'Industrial Automation'], NULL),
  ('LabVIEW', 'Industrial Automation', ARRAY['National Instruments LabVIEW', 'NI LabVIEW'], ARRAY['Test Automation', 'Data Acquisition', 'Measurement'], NULL),
  ('CAN Bus', 'Hardware', ARRAY['CAN', 'Controller Area Network', 'CAN Protocol'], ARRAY['Automotive', 'Embedded Systems', 'Industrial Automation'], NULL),
  ('Signal Processing', 'Hardware', ARRAY['DSP', 'Digital Signal Processing', 'Signalverarbeitung'], ARRAY['MATLAB', 'Python', 'FPGA'], NULL)
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  related_skills = EXCLUDED.related_skills,
  transferability_from = EXCLUDED.transferability_from;

-- Product Management Domain
INSERT INTO skill_taxonomy (canonical_name, category, aliases, related_skills, transferability_from)
VALUES 
  ('Product Management', 'Product', ARRAY['PM', 'Product Manager', 'Produktmanagement', 'Product Lead'], ARRAY['Roadmapping', 'Stakeholder Management', 'User Stories', 'Agile'], '{"Business Analysis": 60, "Project Management": 50}'::jsonb),
  ('Product Owner', 'Product', ARRAY['PO', 'Scrum Product Owner'], ARRAY['Product Management', 'Agile', 'Scrum', 'User Stories'], '{"Product Management": 90}'::jsonb),
  ('Roadmapping', 'Product', ARRAY['Product Roadmap', 'Strategic Roadmap'], ARRAY['Product Management', 'Strategy', 'OKR'], NULL),
  ('User Stories', 'Product', ARRAY['User Story', 'User Story Mapping'], ARRAY['Agile', 'Scrum', 'Product Management'], NULL),
  ('Stakeholder Management', 'Product', ARRAY['Stakeholder Engagement', 'Stakeholder Communication'], ARRAY['Product Management', 'Project Management'], NULL),
  ('Agile', 'Methodology', ARRAY['Agile Methoden', 'Agile Development', 'Agile Methodologies', 'Agiles Arbeiten'], ARRAY['Scrum', 'Kanban', 'SAFe', 'Jira'], '{"Scrum": 95, "Kanban": 90}'::jsonb),
  ('Scrum', 'Methodology', ARRAY['Scrum Framework', 'Scrum Master'], ARRAY['Agile', 'Sprint Planning', 'Jira'], '{"Agile": 90}'::jsonb),
  ('Kanban', 'Methodology', ARRAY['Kanban Board', 'Kanban Method'], ARRAY['Agile', 'Lean', 'Jira'], '{"Agile": 85}'::jsonb),
  ('OKR', 'Methodology', ARRAY['Objectives and Key Results', 'OKR Framework'], ARRAY['Strategy', 'Goal Setting', 'Product Management'], NULL),
  ('B2B SaaS', 'Domain', ARRAY['B2B', 'SaaS', 'Enterprise Software', 'B2B SaaS Kenntnisse', 'Software as a Service'], ARRAY['Enterprise Sales', 'Subscription Models', 'Product Management'], '{"B2C SaaS": 70, "Enterprise": 80}'::jsonb)
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  related_skills = EXCLUDED.related_skills,
  transferability_from = EXCLUDED.transferability_from;

-- Design/UX Domain
INSERT INTO skill_taxonomy (canonical_name, category, aliases, related_skills, transferability_from)
VALUES 
  ('UX Design', 'Design', ARRAY['UX', 'User Experience', 'UX/UI', 'User Experience Design'], ARRAY['Figma', 'User Research', 'Prototyping', 'Wireframing'], '{"UI Design": 75, "Graphic Design": 50}'::jsonb),
  ('UI Design', 'Design', ARRAY['UI', 'User Interface', 'User Interface Design'], ARRAY['Figma', 'Sketch', 'Visual Design', 'Design System'], '{"UX Design": 70, "Graphic Design": 60}'::jsonb),
  ('Figma', 'Design', ARRAY['Figma Design', 'Figma Tool'], ARRAY['UI Design', 'UX Design', 'Prototyping'], '{"Sketch": 85, "Adobe XD": 80}'::jsonb),
  ('Sketch', 'Design', ARRAY['Sketch App', 'Sketch Design'], ARRAY['UI Design', 'UX Design', 'Prototyping'], '{"Figma": 85, "Adobe XD": 80}'::jsonb),
  ('Adobe XD', 'Design', ARRAY['XD', 'Experience Design'], ARRAY['UI Design', 'UX Design', 'Prototyping'], '{"Figma": 80, "Sketch": 80}'::jsonb),
  ('Prototyping', 'Design', ARRAY['Prototype', 'Rapid Prototyping', 'Interactive Prototype'], ARRAY['Figma', 'InVision', 'Principle'], NULL),
  ('User Research', 'Design', ARRAY['UX Research', 'User Testing', 'Usability Testing'], ARRAY['UX Design', 'Interviews', 'Analytics'], NULL),
  ('Design System', 'Design', ARRAY['Design Systems', 'Component Library', 'Style Guide'], ARRAY['UI Design', 'Figma', 'Storybook'], NULL),
  ('Wireframing', 'Design', ARRAY['Wireframe', 'Low-Fidelity Design'], ARRAY['UX Design', 'Prototyping'], NULL)
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  related_skills = EXCLUDED.related_skills,
  transferability_from = EXCLUDED.transferability_from;

-- Leadership/Management Domain
INSERT INTO skill_taxonomy (canonical_name, category, aliases, related_skills, transferability_from)
VALUES 
  ('Team Leadership', 'Leadership', ARRAY['Teamleitung', 'People Management', 'Team Lead', 'Engineering Manager'], ARRAY['Mentoring', 'Hiring', 'Performance Management'], '{"Project Management": 60}'::jsonb),
  ('Technical Leadership', 'Leadership', ARRAY['Tech Lead', 'Technical Lead', 'Engineering Lead'], ARRAY['Architecture', 'Code Review', 'Mentoring'], '{"Team Leadership": 80}'::jsonb),
  ('Project Management', 'Management', ARRAY['PM', 'Projektmanagement', 'Project Manager'], ARRAY['Agile', 'Jira', 'Planning', 'Risk Management'], '{"Product Management": 50}'::jsonb),
  ('Mentoring', 'Leadership', ARRAY['Coaching', 'Developer Mentoring'], ARRAY['Team Leadership', 'Knowledge Transfer'], NULL)
ON CONFLICT (canonical_name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  related_skills = EXCLUDED.related_skills,
  transferability_from = EXCLUDED.transferability_from;