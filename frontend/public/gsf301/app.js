const { useState, useMemo, useEffect, useCallback } = React;
const UNIT_TITLES = {
  1: "Overview of International Freight and Sea Transport",
  2: "International Organizations and Regulations in Sea Transport",
  3: "Geography of Sea Port, Shipping Routes, and Port Facilities",
  4: "Vessels",
  5: "Containerization",
  6: "Shipping Documents",
  7: "Sea Shipping Services",
  8: "Completing a Freight Forwarding Order",
  9: "Sea Freight Pricing"
};
const CARDS = [
  // ===== Unit 1 · Overview of International Freight and Sea Transport =====
  { unit: 1, term: "Freight forwarding (definition)", def: "A service that includes transportation, consolidation, warehousing, packaging, customs clearance, finance, insurance and other support tasks for cargo." },
  { unit: 1, term: "FIATA", def: "International Federation of Freight Forwarders Associations \u2013 the global organization representing freight forwarding companies and providing a standard framework for forwarding operations." },
  { unit: 1, term: "VIFAS", def: "Vietnam Freight Forwarding and Warehousing Association \u2013 the Vietnamese association of forwarding and warehousing firms, FIATA member since 1994." },
  { unit: 1, term: "Forwarder (definition)", def: "An individual or company that acts as an intermediary to arrange the shipment of goods for a shipper, not the carrier, and is responsible for related services such as warehousing and customs clearance." },
  { unit: 1, term: "Article 167 of Vietnamese Commercial Law", def: "Provides that a freight forwarder is entitled to charge fees, must fully perform the contract, notify customers of changes, and act within a reasonable time." },
  { unit: 1, term: "Sea freight transport (definition)", def: "The movement of goods by sea using ports, vessels and handling equipment; the primary mode of transport with large\u2011capacity ships." },
  { unit: 1, term: "Role of sea transport \u2013 market share", def: "Accounts for nearly 80% of total global freight volume, thanks to its ability to move large quantities at low cost." },
  { unit: 1, term: "Advantages of sea transport", def: "High cargo capacity, low cost, and ability to carry bulky and diverse goods." },
  { unit: 1, term: "Disadvantages of sea transport", def: "Long transit times, need for specialized cargo preservation techniques, and high risk during shipment." },
  { unit: 1, term: "Shipper", def: "The person or business that sends goods internationally, responsible for preparation, packaging and compliance with regulations." },
  { unit: 1, term: "Freight Forwarder (Stakeholder)", def: "Logistics agent for the shipper, handling transport arrangements, documentation and customs advice." },
  { unit: 1, term: "Shipping Line", def: "Company that owns and operates cargo vessels, providing sea freight services and scheduling voyages." },
  { unit: 1, term: "Customs Authority", def: "The government agency that controls imports and exports, conducts inspections, collects duties, and ensures legal compliance." },
  { unit: 1, term: "Port and Terminal", def: "Infrastructure where cargo is loaded onto or offloaded from ships, supports customs inspections, and provides handling services." },
  { unit: 1, term: "Regulatory Body (sea transport)", def: "Organization that sets standards, safety rules, and legal regulations for international maritime transport." },
  // ===== Unit 2 · International Organizations and Regulations in Sea Transport =====
  { unit: 2, term: "International Maritime Organization (IMO)", def: "A United Nations agency founded in 1948 (operational since 1958) headquartered in London, responsible for setting safety, security and marine environmental protection standards and issuing conventions such as SOLAS, MARPOL and STCW." },
  { unit: 2, term: "United Nations Conference on Trade and Development (UNCTAD)", def: "Established in 1964 with headquarters in Geneva, this UN body supports global trade development, provides economic analysis and maritime data, including the Review of Maritime Transport report." },
  { unit: 2, term: "Baltic and International Maritime Council (BIMCO)", def: "The world\u2019s largest maritime trade association, founded in 1905, a non\u2011governmental organization that supplies standard contracts, guidelines and advocates for shipowners, brokers and agents." },
  { unit: 2, term: "World Shipping Council (WSC)", def: "A non\u2011governmental association founded in 2000 that represents the global container shipping industry, focusing on policy, environmental and safety issues for container carriers." },
  { unit: 2, term: "International Chamber of Shipping (ICS)", def: "A non\u2011governmental association founded in 1921 that represents national shipowners\u2019 associations, promoting safety, environmental and legal standards for the maritime transport sector." },
  { unit: 2, term: "Comit\xE9 Maritime International (CMI)", def: "A non\u2011profit, non\u2011governmental organization founded in 1897 that works on the unification of international maritime law and helped draft many early maritime conventions." },
  { unit: 2, term: "SOLAS \u2013 Safety of Life at Sea", def: "An international convention issued by the IMO that forms the primary legal framework for ship safety and the protection of lives at sea, covering technical requirements, lifesaving equipment and fire\u2011prevention procedures." },
  { unit: 2, term: "MARPOL \u2013 International Convention for the Prevention of Pollution from Ships", def: "An IMO\u2011issued international convention that sets measures to prevent ship\u2011generated pollution, including the sulfur\u2011fuel limit (IMO 2020) and waste\u2011management controls." },
  { unit: 2, term: "Hague Rules", def: "An international convention adopted in Brussels in 1924 that standardises certain rules of law relating to bills of lading." },
  { unit: 2, term: "Hague\u2011Visby Rules", def: "An international convention amending the Hague Rules, adopted in 1968 and entering into force in 1977." },
  { unit: 2, term: "Hamburg Rules", def: "An international convention governing the carriage of goods by sea, adopted in 1978 and entering into force in 1992." },
  { unit: 2, term: "Rotterdam Rules", def: "An international convention on contracts for the international carriage of goods by sea, adopted in 2008 but not yet in force." },
  { unit: 2, term: "IMDG Code", def: "International Code for the Transport of Dangerous Goods by Sea, issued by the International Maritime Organization (IMO)." },
  { unit: 2, term: "SOLAS", def: "International Convention for the Safety of Life at Sea, adopted in 1974 and entered into force in 1980." },
  { unit: 2, term: "MARPOL", def: "International Convention for the Prevention of Pollution from Ships, adopted in 1973 and entered into force in 1983." },
  { unit: 2, term: "Scope of Application of the Hague Rules", def: "Applies to carriage of goods by sea unless the parties agree otherwise." },
  { unit: 2, term: "Carrier\u2019s Liability under the Hague Rules", def: "The carrier must take necessary measures to ensure cargo safety and is liable for any loss or damage occurring during carriage." },
  { unit: 2, term: "Liability Limit under the Hague\u2011Visby Rules", def: "The carrier may limit liability to 10,000 SDRs or 30 SDRs per kilogram of cargo weight, whichever is higher." },
  { unit: 2, term: "Claim Period under the Hamburg Rules", def: "Claims must be filed within two years from the date of delivery or the date when delivery should have occurred." },
  { unit: 2, term: "Scope of Application of the Hamburg Rules", def: "Applies to carriage of goods by sea, including containerized shipments." },
  { unit: 2, term: "IMDG Code (International Maritime Dangerous Goods Code)", def: "International regulations governing the transport of dangerous goods by sea; applicable to dangerous\u2011goods vessels, freight forwarders, ports, and related personnel." },
  { unit: 2, term: "IMDG Code \u2013 Parts", def: "Consists of seven parts: 1) General provisions, definitions, training; 2) Classification; 3) Dangerous\u2011goods list and special provisions; 4) Packing and containers; 5) Delivery procedures; 6) Packaging design and testing; 7) Operational provisions." },
  { unit: 2, term: "IMDG Code \u2013 9 Hazard Classes", def: "Classifies dangerous goods into nine classes: 1) Explosives, 2) Gases, 3) Flammable liquids, 4) Flammable solids, 5) Oxidizing substances, 6) Toxic/poisonous substances, 7) Radioactive material, 8) Corrosive substances, 9) Miscellaneous dangerous goods." },
  { unit: 2, term: "General Average", def: "An ancient maritime law principle whereby sacrifices or expenses incurred to save a ship, cargo, or voyage are shared proportionally among all parties with an interest in the voyage." },
  { unit: 2, term: "York\u2011Antwerp Rules", def: "International rules that set the conditions for an act to be considered General Average: imminent danger, voluntary action, for the common safety, reasonable and partially successful." },
  { unit: 2, term: "LLMC Convention (Limitation of Liability for Maritime Claims)", def: "International convention that establishes limits on the legal liability of shipowners and related parties for maritime claims." },
  { unit: 2, term: "Vietnam Maritime Code 2015", def: "Comprehensive code governing ship registration, ownership, technical standards, seafarers' rights, port administration, maritime safety, environmental protection, ship seizure and dispute resolution." },
  { unit: 2, term: "Hamburg Rules / Rotterdam Rules (1992/2009)", def: "International conventions that define carrier liability and rights in sea transport; Hamburg Rules adopted in 1978 and Rotterdam Rules in 2009, applicable to multilateral and multimodal transport contracts." },
  // ===== Unit 3 · Geography of Sea Port, Shipping Routes, and Port Facilities =====
  { unit: 3, term: "Seaport", def: "A defined geographic area, usually located in sheltered deep water, serving as a transport and industrial hub in the global supply chain." },
  { unit: 3, term: "Port Accessibility", def: "The ability to reach a port, considering factors such as channel depth, channel width, bridge clearance, and other environmental conditions." },
  { unit: 3, term: "Feeder Services", def: "Cargo transport by feeder vessels that link major hub ports with smaller ports." },
  { unit: 3, term: "Hinterland Connections", def: "The transport network linking a port with its inland region, including road, rail, and inland waterway links." },
  { unit: 3, term: "Port Facilities", def: "Port infrastructure such as piers, berths, warehouses, and cargo handling equipment." },
  { unit: 3, term: "Quay Structures and Berths", def: "The physical quay and berth facilities, encompassing container terminals, general cargo terminals, and specialized terminals." },
  { unit: 3, term: "Cargo Handling Equipment", def: "Equipment used to load and unload cargo, including cranes, forklifts, and other specialized gear." },
  { unit: 3, term: "Storage Facilities", def: "Warehousing and storage sites for cargo, such as container terminals, general cargo warehouses, and silos." },
  { unit: 3, term: "Port Automation", def: "The automation of port operations through technology to improve efficiency and reduce costs." },
  { unit: 3, term: "TEU (Twenty-Foot Equivalent Unit)", def: "A unit equal to a 20\u2011foot container, used to measure containerized cargo volume." },
  { unit: 3, term: "Top 20 Busiest Container Ports", def: "The list of the world\u2019s 20 most active container ports, including Shanghai, Singapore, and Ningbo\u2011Zhoushan." },
  { unit: 3, term: "Vietnamese Port System", def: "Vietnam\u2019s port network, comprising 34 seaports, of which 2 are special ports and 11 are Class I ports." },
  { unit: 3, term: "Channel Depth (Draft Limitation)", def: "Channel depth, a key factor that determines a vessel\u2019s ability to reach a port." },
  { unit: 3, term: "Air Draft (Bridge/Overhead Clearance)", def: "The height of a vessel above the waterline, which must be lower than the clearance of bridges or overhead structures." },
  { unit: 3, term: "Berth Length and Depth", def: "The length and depth of a berth, which must be sufficient to accommodate a vessel and allow safe mooring." },
  { unit: 3, term: "Tidal Range", def: "The range of tide, affecting port accessibility and vessel operations." },
  { unit: 3, term: "Currents and Winds", def: "Water currents and wind, influencing vessel handling and port activities." },
  { unit: 3, term: "Navigational Aids", def: "Navigation support devices, including buoys, lights, radar, and vessel traffic services." },
  { unit: 3, term: "Pilotage and Tugs", def: "Pilot and tug services that assist vessels in berthing and ensure safe port operations." },
  // ===== Unit 4 · Vessels =====
  { unit: 4, term: "Sea vessel (definition)", def: "A vessel used to transport cargo by sea, playing a vital role in international trade." },
  { unit: 4, term: "History of sea vessels", def: "Sea vessels have been used for thousands of years, with the earliest boats made of wood and animal skins." },
  { unit: 4, term: "World fleet", def: "The total number of sea vessels worldwide, encompassing various types such as container ships, dry bulk carriers, oil tankers, etc." },
  { unit: 4, term: "Classification of sea vessels", def: "Sea vessels are classified by purpose, size, and cargo type, including container ships, dry bulk carriers, oil tankers, and others." },
  { unit: 4, term: "Container ship (definition)", def: "A sea vessel designed to carry cargo in containers, commonly used for transporting a wide range of goods." },
  { unit: 4, term: "Container ship sizes", def: "Container ships come in several sizes, including feeder vessels, Panamax, Post\u2011Panamax, and Ultra\u2011Large Container Vessels (ULCV)." },
  { unit: 4, term: "Dry bulk carrier (definition)", def: "A sea vessel that transports dry bulk cargo such as grains, iron ore, coal, and similar commodities." },
  { unit: 4, term: "Classification of dry bulk carriers", def: "Dry bulk carriers are classified by size into mini, Handysize, Supramax, Panamax, and Capesize vessels." },
  { unit: 4, term: "Oil tanker (definition)", def: "A sea vessel built to transport crude oil or petroleum products." },
  { unit: 4, term: "Classification of oil tankers", def: "Oil tankers are categorized by size into small, Panamax, Aframax, Suezmax, and Very Large Crude Carrier (VLCC) vessels." },
  { unit: 4, term: "Gas carrier (definition)", def: "A sea vessel specialized in carrying natural gas or liquefied gas." },
  { unit: 4, term: "Classification of gas carriers", def: "Gas carriers are classified by size into small, medium, and Very Large Gas Carrier (VLGC) vessels." },
  { unit: 4, term: "Ro-Ro Ship (definition)", def: "A type of ocean vessel designed to carry cars, trucks, and other wheeled vehicles." },
  { unit: 4, term: "General Cargo Ship (definition)", def: "A type of ocean vessel that transports a variety of goods, including dry cargo, liquid cargo, and containers." },
  { unit: 4, term: "Multipurpose Ship (definition)", def: "An ocean vessel capable of carrying several different cargo types, such as containers, dry bulk, and liquid bulk." },
  { unit: 4, term: "Trends in Ship Development", def: "Ships are being built to meet growing freight demand, featuring larger sizes, higher efficiency, and reduced environmental impact." },
  { unit: 4, term: "Ship Technology", def: "New technologies such as automation, digitization, and energy\u2011saving measures are being applied to ships to boost performance and lower environmental footprints." },
  { unit: 4, term: "Role of Ships", def: "Ships play a vital role in international trade by transporting goods and raw materials between countries and regions." },
  { unit: 4, term: "Environmental Impact of Ships", def: "Ships have significant environmental effects, including air pollution, water pollution, and damage to marine ecosystems." },
  { unit: 4, term: "Ship Safety Regulations", def: "Ships must comply with strict safety regulations to protect people and cargo, covering design, construction, and operation standards." },
  // ===== Unit 5 · Containerization =====
  { unit: 5, term: "Freight Container (definition)", def: "A durable transport device designed for repeated use, strong enough to carry cargo without disturbing its contents." },
  { unit: 5, term: "FCL \u2013 Full Container Load", def: "Cargo that fills an entire container; the shipper packs and delivers it to the port, and the container is shipped directly to the consignee." },
  { unit: 5, term: "LCL \u2013 Less than Container Load", def: "Cargo insufficient to fill a container; the shipper delivers it to a consolidation point where it is combined with other shippers' goods for transport to the consignee." },
  { unit: 5, term: "CFS \u2013 Container Freight Station", def: "A facility where cargo is consolidated, packed, and handled, offering services such as storage, cleaning, and container repair." },
  { unit: 5, term: "TEU \u2013 Twenty\u2011foot Equivalent Unit", def: "A measurement unit equal to one 20\u2011foot container, used to express the capacity of container ships and terminals." },
  { unit: 5, term: "Gantry Crane (STS)", def: "A crane used to load and unload containers between ship and shore, capable of moving along the quay." },
  { unit: 5, term: "Rubber\u2011Tired Gantry Crane (RTG)", def: "A crane used for container handling within a yard, mounted on rubber\u2011tired wheels for mobility." },
  { unit: 5, term: "Container Terminal", def: "Infrastructure designed to receive, process, and move containers, providing services such as loading, storage, cleaning, and repair." },
  { unit: 5, term: "ISO 668:1995 (E)", def: "International standard governing the design, manufacture, and use of containers, specifying dimensions, weight, durability, and safety requirements." },
  { unit: 5, term: "CSC \u2013 International Convention for Safe Containers", def: "International treaty setting safety standards for containers, covering design, manufacture, inspection, and use to protect people and cargo." },
  { unit: 5, term: "Container Leasing", def: "The rental of containers for a specified period, allowing companies to avoid purchasing and maintaining their own units." },
  { unit: 5, term: "Panamax", def: "A class of container ship sized to transit the Panama Canal, approximately 294.1\u202Fm in length and 32.3\u202Fm in beam." },
  { unit: 5, term: "Container Ship", def: "A specialized vessel for transporting containers, with capacity ranging from a few thousand to several tens of thousands of TEU." },
  { unit: 5, term: "BAY, ROW, TIER", def: "Terms used to locate a container on a ship: longitudinal position (BAY), transverse position (ROW), and vertical position (TIER)." },
  { unit: 5, term: "Container Freight Station (CFS) Activities", def: "Operations carried out at a CFS, including storage, cleaning, container repair, as well as packing, loading/unloading, and inland transport services." },
  { unit: 5, term: "Container", def: "A unit for holding and moving cargo, typically made of steel or plastic." },
  { unit: 5, term: "ISO", def: "The International Organization for Standardization, which sets standards for containers such as dimensions, weight limits, etc." },
  { unit: 5, term: "Dry Container", def: "A container designed for dry cargo that does not require special temperature or humidity conditions." },
  { unit: 5, term: "Reefer Container", def: "A temperature\u2011controlled container used for goods that must be kept cold, commonly food or other perishable items." },
  { unit: 5, term: "Open Top Container", def: "A container with a removable roof, used for oversized cargo or goods that need to be loaded from the top." },
  { unit: 5, term: "Flat Rack Container", def: "A container with a flat floor and no sidewalls, suitable for oversized cargo or items that must be loaded from either side." },
  { unit: 5, term: "Tank Container", def: "A container built to transport liquids, typically oil, water, or chemicals." },
  { unit: 5, term: "TEU", def: "A measurement unit for container capacity, equivalent to a 20\u2011foot (6.1\u202Fm) container." },
  { unit: 5, term: "FEU", def: "A measurement unit for container capacity, equivalent to a 40\u2011foot (12.2\u202Fm) container." },
  { unit: 5, term: "BIC Code", def: "The identification code of the container owner, consisting of three letters and one number." },
  { unit: 5, term: "CSC Plate", def: "The container safety information plate, showing owner, manufacturer, weight and other technical specifications." },
  { unit: 5, term: "Check Digit", def: "The verification digit of a container, used to confirm the accuracy of the container code." },
  { unit: 5, term: "Loading Gauge", def: "The standard for the dimensions and weight of rail vehicles and cargo, ensuring safety and preventing collisions." },
  { unit: 5, term: "UIC", def: "The International Union of Railways, which sets standards for railways and rolling stock." },
  { unit: 5, term: "Container Size", def: "The dimensions of a container, typically defined by ISO standards, such as 20\u2011ft, 40\u2011ft, 45\u2011ft, etc." },
  { unit: 5, term: "Container Type", def: "The category of container, including dry, refrigerated (reefer), open\u2011top, flat\u2011rack, tank, and others." },
  { unit: 5, term: "Container Marking", def: "The practice of marking a container with information such as code, weight, size and other technical data." },
  { unit: 5, term: "Loading Procedures in Container Traffic", def: "The process of loading cargo into a container to ensure safety and prevent damage during transport." },
  { unit: 5, term: "Weight Limits", def: "The maximum allowable weight for containers and transport equipment to maintain safety and avoid accidents." },
  { unit: 5, term: "Center of Gravity", def: "The point in a container where the total weight of the container and its contents is balanced." },
  { unit: 5, term: "Stowage Plan", def: "The plan for arranging cargo in a container to optimize space and ensure safety." },
  { unit: 5, term: "Packing Requirements", def: "Requirements for packaging and packing goods to ensure safety and prevent damage during transport." },
  { unit: 5, term: "Securing the Packages", def: "Methods for fixing and protecting cargo inside a container to avoid damage and accidents." },
  { unit: 5, term: "Container Inspection", def: "Inspection of a container before loading to ensure safety and prevent damage." },
  { unit: 5, term: "Container Packing Operation", def: "Procedure for loading a container, including preparation, stowage, securing, and finalization." },
  { unit: 5, term: "Golden Rules", def: "Key rules for container loading, such as not placing perishable goods with non\u2011perishables and not stacking heavy items on light ones." },
  { unit: 5, term: "Container Packing Problems", def: "Potential issues when loading a container, including cargo damage, accidents, and safety hazards." },
  { unit: 5, term: "Stresses During Transport", def: "Forces and stresses encountered during transport, such as vibration, impact, and temperature changes." },
  { unit: 5, term: "Preventing Condensation", def: "Methods to prevent moisture condensation inside a container, including using moisture\u2011resistant materials, ventilation, and temperature control." },
  { unit: 5, term: "Packing Special Cargoes", def: "Procedures for packing special cargoes, such as perishables, heavy items, and goods requiring special preservation." },
  { unit: 5, term: "Completing Packing", def: "Final steps in container loading, including inspection, documentation, and paperwork completion." },
  { unit: 5, term: "Unpacking", def: "Process of unloading cargo from a container, including inspection, arrangement, and finalization." },
  // ===== Unit 6 · Shipping Documents =====
  { unit: 6, term: "Bill of Lading (B/L)", def: "A sea waybill is the most important document in maritime transport, evidencing the contract of carriage of goods." },
  { unit: 6, term: "Three primary functions of Bill of Lading", def: "It serves as a receipt for the goods, evidence of the carriage contract, and a document of title to the goods." },
  { unit: 6, term: "Negotiable Bill of Lading", def: 'A transferable bill of lading issued "to order," allowing the holder to assign the right to receive the cargo.' },
  { unit: 6, term: "Non-Negotiable Bill of Lading", def: "A non\u2011transferable bill of lading issued directly to the consignee and not serving as a document of title." },
  { unit: 6, term: "Clean Bill of Lading", def: "A bill indicating that the cargo was received in good condition, without damage or defects." },
  { unit: 6, term: "Claused (Dirty) Bill of Lading", def: "A bill noting damage or defects to the cargo, often unacceptable for trade finance." },
  { unit: 6, term: "Sea Waybill", def: "A transport document that evidences the sea carriage contract but does not confer title to the goods." },
  { unit: 6, term: "Booking Note", def: "A document containing booking details, including information on the cargo, shipper, and consignee." },
  { unit: 6, term: "Charter Party Bill of Lading", def: "A bill issued under a charter\u2011party agreement, commonly used for bulk cargo shipments." },
  { unit: 6, term: "Master Bill of Lading", def: "A bill issued by the actual carrier, representing the contract of carriage for the goods." },
  { unit: 6, term: "House Bill of Lading", def: "A bill issued by a freight forwarder or agent, representing the contract of carriage for the goods." },
  { unit: 6, term: "Switch Bill of Lading", def: "A bill issued to replace the original one, typically used in complex international trade transactions." },
  { unit: 6, term: "Electronic Bill of Lading (e-B/L)", def: "The electronic version of a sea waybill that reduces paperwork and speeds up transactions." },
  { unit: 6, term: "Letter of Indemnity (LOI)", def: "A document that states one party's commitment to compensate the other for any loss or damage." },
  { unit: 6, term: "Cargo Manifest", def: "A document providing detailed information on the cargo, including quantity, weight, and consignee." },
  { unit: 6, term: "Commercial Invoice", def: "A document showing the value of the goods, including sale price, taxes, and other charges." },
  { unit: 6, term: "Dangerous Goods Declaration", def: "A document detailing hazardous cargo, including classification, packaging, and handling instructions." },
  // ===== Unit 7 · Sea Shipping Services =====
  { unit: 7, term: "Liner Shipping", def: "A scheduled sea transport service that provides reliable connections for cargo of any size." },
  { unit: 7, term: "Tramp Shipping", def: "A non\u2011scheduled sea transport service that hires vessels to move cargo from one port to another." },
  { unit: 7, term: "Booking Note", def: "The initial confirmation between shipper and carrier that space has been reserved on a vessel for a specified quantity and description of goods." },
  { unit: 7, term: "Charter Party", def: "A legally binding ship\u2011rental contract between the shipowner and the charterer, setting out the rights, responsibilities and obligations of both parties." },
  { unit: 7, term: "Voyage Charter", def: "Chartering a vessel for a specific voyage, with freight calculated per ton of cargo carried or on a fixed\u2011rate basis." },
  { unit: 7, term: "Time Charter", def: "Chartering a vessel for a defined period; the charterer determines the route and cargo while the shipowner provides the vessel and crew." },
  { unit: 7, term: "Bareboat Charter", def: "Chartering a vessel without crew; the charterer assumes full responsibility for operating and maintaining the ship during the hire period." },
  { unit: 7, term: "Slot Charter Agreement", def: "A contract to lease a portion of a vessel\u2019s capacity, allowing the charterer to use only part of the ship for cargo transport." },
  { unit: 7, term: "Vessel Sharing Agreement (VSA)", def: "An agreement among shipping companies to share vessel space and cooperate on specific routes." },
  { unit: 7, term: "Conference", def: "A group of shipping companies that cooperate to provide sea transport services on a particular route or region with standardized rates." },
  { unit: 7, term: "Non-Conference Lines", def: "Shipping companies that operate independently and do not participate in conferences or vessel\u2011sharing agreements." },
  { unit: 7, term: "Consortia", def: "A cooperative arrangement among shipping companies to offer services on specific routes, enhancing efficiency and reducing costs." },
  { unit: 7, term: "Alliances", def: "A broad form of cooperation among shipping companies that share vessel capacity and collaborate on multiple routes to improve efficiency and reduce costs." },
  { unit: 7, term: "Shipowner", def: "The owner, an individual or company that possesses and operates a vessel." },
  { unit: 7, term: "Charterer", def: "The charterer, an individual or company that hires a vessel to transport cargo." },
  { unit: 7, term: "Shipbroker", def: "A shipbroker, an individual or company acting as an intermediary to negotiate and finalize charter contracts between shipowners and charterers." },
  { unit: 7, term: "Laytime", def: "The allotted time for loading or unloading cargo without incurring vessel detention charges." },
  { unit: 7, term: "Demurrage", def: "A charge payable by the charterer to the shipowner when loading or unloading exceeds the allowed laytime." },
  { unit: 7, term: "Despatch", def: "A reward paid by the shipowner to the charterer when loading or unloading is completed before the allowed laytime." },
  { unit: 7, term: "FCL (Full Container Load)", def: "Full container load, a shipping method where the cargo occupies the entire volume of a container." },
  { unit: 7, term: "LCL (Less than Container Load)", def: "Less than container load, a shipping method where cargo does not fill an entire container and is typically consolidated with cargo from other shippers." },
  // ===== Unit 8 · Completing a Freight Forwarding Order =====
  { unit: 8, term: "Freight Forwarding Order", def: "Freight forwarding order \u2013 a document recording the shipping request, cargo information, parties involved, and required services." },
  { unit: 8, term: "Export process (quy tr\xECnh xu\u1EA5t kh\u1EA9u)", def: "Steps: sign contract, obtain export license, book and collect empty containers, prepare and inspect cargo, pack and seal, purchase insurance, complete customs formalities, load onto vessel, and settle payment." },
  { unit: 8, term: "Import process (quy tr\xECnh nh\u1EADp kh\u1EA9u)", def: "Steps: receive arrival notice, register related certificates, file customs declaration, open and clear customs, pay duties, transport to warehouse, unload and return containers, and retain records." },
  { unit: 8, term: "Proforma Invoice", def: "Proforma invoice \u2013 provides buyer and seller details, product description, HS code, price, Incoterms, delivery location, and currency; used as a quotation before contract signing." },
  { unit: 8, term: "Commercial Invoice", def: "Commercial invoice \u2013 the definitive transaction document, including order number, purchase order, bank details, insurance, used for payment and as a basis for other documents." },
  { unit: 8, term: "Packing List", def: "Packing list \u2013 itemizes each package, net and gross weight, dimensions, markings, and special instructions; supports the bill of lading, letters of credit, and customs." },
  { unit: 8, term: "Certificate of Origin (CO)", def: "Certificate of origin \u2013 certifies the country where the goods were produced, usually issued by a chamber of commerce or consulate; may be electronic (eCO)." },
  { unit: 8, term: "Shipper\u2019s Letter of Instruction (SLI)", def: "Shipper\u2019s Letter of Instruction \u2013 provides the freight forwarder with shipping requirements, cargo details, Incoterm, insurance, and accompanying documents." },
  { unit: 8, term: "Bill of Lading (B/L)", def: "Bill of lading \u2013 legal transport document, available in three types: inland B/L (domestic), ocean B/L (sea), and airway bill (air)." },
  { unit: 8, term: "Dangerous Goods Form", def: "Dangerous goods declaration form \u2013 IATA Shipper\u2019s Declaration for air transport or IMO form for sea transport; the declarant must be trained." },
  { unit: 8, term: "Bank Draft (Documentary Collection)", def: "Bank draft \u2013 an international trade payment method accompanied by documents; the seller\u2019s bank forwards documents to the buyer\u2019s bank, and the buyer receives them upon payment." },
  { unit: 8, term: "EDI \u2013 Electronic Data Interchange", def: "Electronic Data Interchange \u2013 technology for rapid, paper\u2011less transmission of documents (e.g., sea waybill), non\u2011transferable." },
  { unit: 8, term: "Sea Waybill (non\u2011negotiable B/L)", def: "Sea Waybill \u2013 a non\u2011negotiable electronic bill of lading transmitted by EDI to the destination\u2011port agent, used as a notification to the consignee." },
  { unit: 8, term: "Incoterms (International Commercial Terms)", def: "Incoterms \u2013 international commercial terms (e.g., FOB, CIF) that define the responsibilities, costs and risks between seller and buyer in import\u2011export transactions." },
  // ===== Unit 9 · Sea Freight Pricing =====
  { unit: 9, term: "Base Ocean Freight", def: "The basic ocean freight rate, covering the cost of transporting cargo from the loading port to the discharge port." },
  { unit: 9, term: "Freight Unit", def: "The unit of measurement for ocean freight, usually TEU (twenty\u2011foot equivalent unit) or FEU (forty\u2011foot equivalent unit)." },
  { unit: 9, term: "Freight All Kinds (FAK)", def: "A flat ocean freight rate applied to various types of cargo, with a fixed price per container." },
  { unit: 9, term: "Rate As Known (RAK)", def: "An ocean freight rate used for high\u2011value or specially handled cargo, determined based on the cargo\u2019s value." },
  { unit: 9, term: "Named Account (NAC) / Named Cargo", def: "An ocean freight rate negotiated specifically for a particular customer or a specific type of cargo." },
  { unit: 9, term: "Bunker Adjustment Factor (BAF) / Fuel Adjustment Factor (FAF)", def: "A surcharge applied to adjust the freight rate according to fuel costs." },
  { unit: 9, term: "Currency Adjustment Factor (CAF)", def: "A surcharge applied to adjust the freight rate based on foreign\u2011exchange fluctuations." },
  { unit: 9, term: "Terminal Handling Charges (THC) / Container Service Charges (CSC) / Terminal Receiving Charges (TRC)", def: "Surcharges for container handling services at the port." },
  { unit: 9, term: "Incoterms", def: "International commercial terms that define the responsibilities and costs of parties involved in the transport of goods." },
  { unit: 9, term: "EXW (Ex Works)", def: "An Incoterm where the seller\u2019s only obligation is to make the goods available at the production site; the buyer bears all transport responsibilities and costs from that point." },
  { unit: 9, term: "FOB (Free On Board)", def: "An Incoterm where the seller delivers the goods onto the vessel at the loading port, and the buyer assumes responsibility and costs from that point onward." },
  { unit: 9, term: "CFR (Cost and Freight)", def: "An Incoterm where the seller delivers the goods onto the vessel at the loading port and pays for transport to the destination port, while the buyer assumes risk after loading." },
  { unit: 9, term: "CIF (Cost, Insurance and Freight)", def: "It is an international commercial term requiring the seller to deliver the goods on board at the loading port and to bear the cost of transport and insurance to the discharge port." },
  { unit: 9, term: "Laytime", def: "The period allowed for loading or unloading cargo at a port." },
  { unit: 9, term: "Demurrage", def: "A penalty payable when loading or unloading exceeds the allowed laytime." },
  { unit: 9, term: "Despatch", def: "A reward payable when loading or unloading is completed before the allowed laytime." },
  { unit: 9, term: "Detention", def: "The condition where a vessel is held beyond the permitted time, potentially resulting in a penalty or compensation." },
  { unit: 9, term: "Tramp Freight", def: "A type of sea transport without a fixed schedule, usually used for special cargoes or dedicated shipments." },
  { unit: 9, term: "Time Charter", def: "A vessel hire based on a specified period, commonly used for long\u2011term or complex shipping projects." }
];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function withIds(cards) {
  return cards.map((c, i) => ({ ...c, id: i }));
}
const ALL = withIds(CARDS);
const QUIZ_BANK = [
  // ===== Unit 1 · Overview of International Freight and Sea Transport =====
  { unit: 1, question: "A maritime transport company wants to define its role in the supply chain. According to the slide, what is the main role of a Shipping Line?", options: ["Provide cargo transportation services on vessels, maintain vessels and schedule voyages", "Handle customs declarations and collect taxes for the cargo", "Manage warehouses and distribute goods to the final customer", "Negotiate sale prices between exporters and importers"], correct: 0, explain: "A Shipping Line only operates ships and provides transport services; other tasks belong to different stakeholders." },
  { unit: 1, question: "According to FIATA, a freight forwarder is not liable for which of the following?", options: ["Errors of a third party if the forwarder performed due diligence when selecting them", "Errors of internal staff while performing the contract", "Losses caused by delivery delays due to uncontrollable natural disasters", "Mistakes in providing false information that the customer supplied"], correct: 0, explain: "FIATA states that a forwarder is not liable for third\u2011party errors if due diligence was exercised when selecting them." },
  { unit: 1, question: "In a sea carriage contract, if a forwarder discovers that it cannot follow the shipper\u2019s instructions, what must it do under Article 167 of the Vietnamese Commercial Code?", options: ["Proceed according to an internal decision without notifying anyone", "Notify the shipper immediately and request new instructions", "Refuse to act and keep any fees already received", "Send a claim for compensation to the shipper without prior notice"], correct: 1, explain: "Article 167 requires the forwarder to notify the shipper promptly when it cannot comply and to request new guidance." },
  { unit: 1, question: "Comparing the advantages and disadvantages of sea transport, which statement correctly describes a disadvantage?", options: ["Higher cost compared with road transport", "Shorter transit time than most other modes", "Requires cargo preservation techniques on board to maintain quality", "Cannot carry bulky and diverse goods"], correct: 2, explain: "A disadvantage of sea transport is the need for preservation techniques to keep cargo quality; costs are usually lower and transit times longer." },
  { unit: 1, question: "An exporter wants to know who is primarily responsible for preparing and packing goods before export. According to the slide, which stakeholder has this responsibility?", options: ["Freight Forwarder", "Shipper", "Customs Authority", "Port Terminal"], correct: 1, explain: "The shipper is responsible for preparing and packing the cargo; the forwarder only manages logistics." },
  { unit: 1, question: "If an insurance company wants to join the sea\u2011freight supply chain, what role will it play?", options: ["Provide cargo insurance to protect against loss or damage", "Manage warehouses and distribute goods to the final customer", "Conduct customs inspections and collect import taxes", "Operate vessels and schedule voyages"], correct: 0, explain: "Insurance companies provide cargo insurance; the other functions are not their responsibility." },
  { unit: 1, question: "During transportation, who has the authority to decide which vessel and route to use?", options: ["Freight Forwarder", "Customs Authority", "Shipper", "End Customer"], correct: 0, explain: "The forwarder has the freedom to select the appropriate vessel and route according to the customer's requirements." },
  { unit: 1, question: "According to the slide, what percentage of global cargo volume is transported by sea?", options: ["Approximately 80%", "Approximately 50%", "Approximately 30%", "Approximately 95%"], correct: 0, explain: "Sea transport accounts for about 80% of the total global cargo volume." },
  { unit: 1, question: "When a freight forwarder provides customs services, they are also called:", options: ["Customs Broker (customs agent)", "Shipping Line", "Port Operator", "Transport Operator"], correct: 0, explain: "A forwarder can act as a Customs Broker, offering customs services to customers." },
  { unit: 1, question: "If a company wants to expand its operations into the international market, which factor is most important when selecting an export port?", options: ["Port capacity and infrastructure that can handle the expected volume", "Distance from the company's headquarters to the port", "Number of insurance service providers at the port", "Number of restaurants and hotels around the port"], correct: 0, explain: "Port capacity and infrastructure determine the ability to handle cargo volume; the other factors do not directly decide the choice." },
  // ===== Unit 2 · International Organizations and Regulations in Sea Transport =====
  { unit: 2, question: "A shipping company wants to comply with regulations limiting sulfur content in fuel for vessels operating outside Emission Control Areas (ECA). Which of the following is the primary legal source for this requirement?", options: ["MARPOL Annex\u202FVI \u2013 IMO\u202F2020 Sulphur Cap", "SOLAS Chapter\u202FVI \u2013 Verified Gross Mass", "STCW Convention \u2013 Training of Seafarers", "BIMCO Standard Charter Party"], correct: 0, explain: "The IMO\u202F2020 Sulphur Cap, set out in MARPOL Annex\u202FVI, reduces the maximum sulfur limit from 3.5% to 0.5% for ships outside ECAs." },
  { unit: 2, question: "When a country is considering ratifying a new international convention on maritime safety, which organization has the authority to develop and propose binding legal conventions for the shipping industry?", options: ["International Maritime Organization (IMO)", "World Shipping Council (WSC)", "Baltic and International Maritime Council (BIMCO)", "United Nations Conference on Trade and Development (UNCTAD)"], correct: 0, explain: "IMO is the UN inter\u2011governmental body empowered to draft and adopt binding conventions such as SOLAS and MARPOL." },
  { unit: 2, question: 'As a market analyst you need data on fleet development trends and global freight rates. Which organization publishes the annual "Review of Maritime Transport" report?', options: ["UNCTAD", "ICS", "CMI", "WSC"], correct: 0, explain: "UNCTAD releases the Review of Maritime Transport, providing analysis of traffic, fleet size and freight rates." },
  { unit: 2, question: "A shipping line wants to use a standard contract to reduce disputes in chartering. Which model contract was developed by the largest non\u2011governmental organization representing shipowners?", options: ["BIMCO Charter Party", "SOLAS Safety Certificate", "MARPOL Pollution Prevention Certificate", "Hague\u2011Visby Rules"], correct: 0, explain: "BIMCO, the largest non\u2011governmental shipowners\u2019 association, provides the standard BIMCO Charter Party form." },
  { unit: 2, question: "At an international meeting, a representative of a non\u2011governmental association wishes to propose a new standard for seafarer training and certification. Which of the following standards falls within this association\u2019s scope of responsibility?", options: ["STCW Convention", "SOLAS Convention", "MARPOL Convention", "IMO\u202F2020 Sulphur Cap"], correct: 0, explain: "The STCW (Standards of Training, Certification and Watchkeeping) Convention is developed by IMO, but NGOs such as BIMCO and CMI regularly contribute input to its standards." },
  { unit: 2, question: "You are comparing the roles of IMO and BIMCO. Which statement correctly describes the main difference between them?", options: ["IMO is an inter\u2011governmental body that drafts binding conventions; BIMCO is a non\u2011governmental organization that provides model contracts and practical standards.", "IMO focuses on market research; BIMCO is responsible for ship safety oversight.", "IMO deals only with environmental issues; BIMCO deals only with ship insurance.", "Both IMO and BIMCO are UN agencies, but IMO specializes in security while BIMCO specializes in finance."], correct: 0, explain: "IMO is the inter\u2011governmental body that creates legal conventions; BIMCO is a non\u2011governmental group that offers contract templates and practical guidance." },
  { unit: 2, question: "Why were the Hague Rules of 1924 introduced?", options: ["To increase the carrier\u2019s liability", "To reduce the carrier\u2019s liability", "To balance the interests of carriers and shippers", "To eliminate the carrier\u2019s liability entirely"], correct: 2, explain: "The Hague Rules were adopted to address the imbalance in maritime contracts where carriers typically held more power than shippers." },
  { unit: 2, question: "To which type of cargo do the Hague\u2011Visby Rules not apply?", options: ["General cargo", "Special cargo", "Dangerous cargo", "Live animals and cargo on deck"], correct: 3, explain: "The Hague\u2011Visby Rules exclude live animals and cargo carried on deck, as specified in the convention." },
  { unit: 2, question: "What responsibilities does the carrier have under the Hague Rules?", options: ["Only includes the transportation of the cargo", "Includes the preservation and storage of the cargo", "Includes providing information about the cargo", "Includes inspecting and verifying the cargo"], correct: 1, explain: "The carrier's liability under the Hague Rules covers safe and assured transportation of the cargo, but does not include other duties such as preservation and storage." },
  { unit: 2, question: "What is the limitation period for claims under the Hague-Visby Rules?", options: ["1 year", "2 years", "3 years", "5 years"], correct: 0, explain: "The claim period under the Hague-Visby Rules is 1 year from the date of delivery or the expected date of delivery." },
  { unit: 2, question: "What is the carrier's liability limit under the Hague-Visby Rules?", options: ["100 pounds sterling per package", "10,000 francs per package", "666.67 SDR per package", "835 SDR per package"], correct: 1, explain: "The carrier's liability limit under the Hague-Visby Rules is 10,000 francs per package or 30 francs per kilogram of cargo weight, whichever is higher." },
  { unit: 2, question: "To which mode of transport do the Hamburg Rules apply?", options: ["Sea freight", "Road freight", "Air freight", "Multimodal transport"], correct: 0, explain: "The Hamburg Rules apply to sea freight, including containerized cargo shipments." },
  { unit: 2, question: "What responsibilities does the carrier have under the Hamburg Rules?", options: ["Only includes the transportation of the cargo", "Includes the preservation and storage of the cargo", "Includes providing information about the cargo", "Includes inspecting and verifying the cargo, as well as preservation and storage"], correct: 3, explain: "Under the Hamburg Rules, the carrier is responsible for safe and assured transportation of the cargo as well as its preservation and storage." },
  { unit: 2, question: "What issue were the Rotterdam Rules enacted to address?", options: ["To increase the carrier's liability", "To reduce the carrier's liability", "To provide a unified legal framework for international cargo transport", "To eliminate the carrier's liability entirely"], correct: 2, explain: "The Rotterdam Rules were adopted to provide a unified, modern legal framework for international cargo transport, including multimodal shipments." },
  { unit: 2, question: "In the case of a hazardous cargo vessel in danger that decides to jettison a cargo container to save the ship, which of the following is NOT a condition for this action to be recognized as General Average under the York\u2011Antwerp Rules?", options: ["The action must be carried out voluntarily and intentionally by the master or an authorized person", "The action must aim to protect the entire maritime enterprise (ship, cargo, freight)", "The action must be taken after a customs court decision", "The action must occur in an imminent, real, and serious danger situation"], correct: 2, explain: "General Average does not require a customs court decision; the other conditions (imminent danger, voluntary action, for the common benefit) are mandatory." },
  { unit: 2, question: "A maritime carrier wants to know which parties are required to comply with the IMDG Code. Which of the following is NOT within the scope of the IMDG Code?", options: ["Carriers transporting hazardous goods on container ships", "Domestic warehouse service providers unrelated to hazardous goods", "Customs officers and port staff responsible for inspecting hazardous goods", "Rescue personnel and maritime safety experts involved in the transport process"], correct: 1, explain: "The IMDG Code applies to parties involved in the transport of hazardous goods; a domestic warehouse provider unrelated to hazardous goods is not required to comply." },
  { unit: 2, question: "According to the IMDG Code 2016, which hazardous material class is classified as \u201CCorrosive substances\u201D?", options: ["Class 4", "Class 6", "Class 8", "Class 9"], correct: 2, explain: "Class 8 in the IMDG Code covers corrosive substances." },
  { unit: 2, question: "An exporter wants to pack a flammable liquid for sea transport. Which part of the IMDG Code provides guidance on selecting the appropriate packaging?", options: ["Part 2: Classification", "Part 4: Packing and tank provisions", "Part 6: Construction and testing of packagings", "Part 7: Provisions concerning transport operations"], correct: 1, explain: "Part 4 of the IMDG Code deals with packing and the requirements for containers, including flammable liquids." },
  { unit: 2, question: "Trong Lu\u1EADt H\xE0ng h\u1EA3i Vi\u1EC7t Nam 2015, quy \u0111\u1ECBnh n\xE0o sau \u0111\xE2y KH\xD4NG li\xEAn quan tr\u1EF1c ti\u1EBFp \u0111\u1EBFn vi\u1EC7c b\u1EAFt gi\u1EEF (arrest) t\xE0u?", options: ["Quy \u0111\u1ECBnh v\u1EC1 quy\u1EC1n s\u1EDF h\u1EEFu v\xE0 \u0111\u0103ng k\xFD t\xE0u", "Quy \u0111\u1ECBnh v\u1EC1 th\u1EE7 t\u1EE5c ph\xE1p l\xFD \u0111\u1EC3 t\u1EA1m gi\u1EEF t\xE0u khi c\xF3 tranh ch\u1EA5p", "Quy \u0111\u1ECBnh v\u1EC1 c\xE1c bi\u1EC7n ph\xE1p b\u1EA3o v\u1EC7 m\xF4i tr\u01B0\u1EDDng bi\u1EC3n", "Quy \u0111\u1ECBnh v\u1EC1 tr\xE1ch nhi\u1EC7m c\u1EE7a ch\u1EE7 t\xE0u \u0111\u1ED1i v\u1EDBi n\u1EE3 ph\u1EA3i tr\u1EA3"], correct: 2, explain: "C\xE1c bi\u1EC7n ph\xE1p b\u1EA3o v\u1EC7 m\xF4i tr\u01B0\u1EDDng kh\xF4ng ph\u1EA3i l\xE0 ph\u1EA7n quy \u0111\u1ECBnh v\u1EC1 arrest t\xE0u; c\xE1c m\u1EE5c kh\xE1c li\xEAn quan t\u1EDBi quy\u1EC1n s\u1EDF h\u1EEFu, th\u1EE7 t\u1EE5c ph\xE1p l\xFD v\xE0 tr\xE1ch nhi\u1EC7m t\xE0i ch\xEDnh." },
  // ===== Unit 3 · Geography of Sea Port, Shipping Routes, and Port Facilities =====
  { unit: 3, question: "According to Lloyd's List data, which port was the busiest container port in the world in 2023?", options: ["Shanghai Port", "Singapore Port", "Ningbo\u2011Zhoushan Port", "Shenzhen Port"], correct: 0, explain: "Lloyd's List reports that Shanghai was the busiest container port in 2023, handling over 49\u202Fmillion TEU." },
  { unit: 3, question: "What is a feeder service?", options: ["A service transporting cargo between major ports", "A service transporting cargo between smaller ports and major ports", "A service transporting cargo between countries", "A service transporting cargo between cities"], correct: 1, explain: "A feeder service moves cargo between smaller ports and larger ports using feeder vessels." },
  { unit: 3, question: "What facilities are included in a seaport\u2019s infrastructure?", options: ["Cargo yards, berths, cranes", "Cargo yards, berths, railways", "Cargo yards, cranes, roads", "Berths, cranes, railways"], correct: 0, explain: "A seaport\u2019s infrastructure comprises cargo yards, berths, cranes, and other equipment that support cargo handling." },
  { unit: 3, question: "How many seaports are in Vietnam\u2019s port system?", options: ["20 ports", "30 ports", "34 ports", "40 ports"], correct: 2, explain: "Vietnam\u2019s port system consists of 34 seaports, classified by size and function." },
  { unit: 3, question: "T\xE1c d\u1EE5ng c\u1EE7a vi\u1EC7c t\u1EF1 \u0111\u1ED9ng h\xF3a c\u1EA3ng bi\u1EC3n l\xE0 g\xEC?", options: ["T\u0103ng chi ph\xED v\u1EADn h\xE0nh", "Gi\u1EA3m n\u0103ng su\u1EA5t lao \u0111\u1ED9ng", "T\u0103ng n\u0103ng su\u1EA5t lao \u0111\u1ED9ng v\xE0 gi\u1EA3m chi ph\xED v\u1EADn h\xE0nh", "Gi\u1EA3m l\u01B0\u1EE3ng h\xE0ng h\xF3a th\xF4ng qua c\u1EA3ng"], correct: 2, explain: "T\xE1c d\u1EE5ng c\u1EE7a vi\u1EC7c t\u1EF1 \u0111\u1ED9ng h\xF3a c\u1EA3ng bi\u1EC3n l\xE0 t\u0103ng n\u0103ng su\u1EA5t lao \u0111\u1ED9ng v\xE0 gi\u1EA3m chi ph\xED v\u1EADn h\xE0nh, gi\xFAp c\u1EA3ng bi\u1EC3n tr\u1EDF n\xEAn hi\u1EC7u qu\u1EA3 h\u01A1n." },
  { unit: 3, question: "What is the biggest challenge facing ports today?", options: ["Impact of climate change", "Growth in cargo volumes", "Competition among ports", "All of the above"], correct: 3, explain: "The greatest challenge is a combination of factors: climate\u2011change impacts, rising cargo volumes, and competition among ports." },
  { unit: 3, question: "What is a crane?", options: ["Equipment used to lift cargo", "Equipment used to move cargo", "Equipment used to store cargo", "Equipment used to protect cargo"], correct: 0, explain: "A crane is equipment used to lift cargo, facilitating easier and more efficient handling." },
  { unit: 3, question: "What is a feeder vessel?", options: ["A vessel that transports cargo between major ports", "A vessel that transports cargo between smaller ports and major ports", "A vessel that transports cargo between countries", "A vessel that transports cargo between cities"], correct: 1, explain: "A feeder vessel carries cargo between smaller ports and larger ports, simplifying and speeding up cargo movement." },
  { unit: 3, question: "What components make up the transportation system that connects seaports with the inland region?", options: ["Road, rail, and waterway", "Road and rail", "Road and waterway", "Rail and waterway"], correct: 0, explain: "The transportation system linking seaports to the inland area includes road, rail, and waterway modes, facilitating easier and more efficient cargo movement." },
  { unit: 3, question: "What is the purpose of developing a seaport system?", options: ["Enhance the competitive capability of seaports", "Develop the regional economy", "Strengthen national security", "All of the above"], correct: 3, explain: "Developing a seaport system aims to boost seaport competitiveness, foster regional economic growth, and reinforce national security, making ports a vital part of the national economy." },
  // ===== Unit 4 · Vessels =====
  { unit: 4, question: "The Pesse canoe is the oldest known boat; what is its approximate dating?", options: ["8250\u202F\u2013\u202F7550\u202FBCE", "4000\u202F\u2013\u202F3000\u202FBCE", "2500\u202FBCE", "1750\u202F\u2013\u202F1900\u202FCE"], correct: 0, explain: "The Pesse canoe dates to about 8250\u20137550\u202FBCE." },
  { unit: 4, question: "Which type of vessel is used to transport dry cargo and is specially designed to hold cargo in containers?", options: ["General cargo ship", "Container ship", "Oil tanker", "Multipurpose vessel"], correct: 1, explain: "A container ship is specially designed to carry cargo in containers." },
  { unit: 4, question: "What is the purpose of the bay\u2011row\u2011tier system on a container ship?", options: ["Positioning containers on the ship", "Inspecting container condition", "Marking containers", "Storing containers"], correct: 0, explain: "The bay\u2011row\u2011tier system is used to locate containers on the vessel." },
  { unit: 4, question: "Which vessel is designed to carry liquid cargo and can transport oil, liquid chemicals, and food products?", options: ["General cargo ship", "Container ship", "Oil tanker", "Multipurpose vessel"], correct: 2, explain: "An oil tanker is built to carry liquid cargo such as oil, chemicals, and food-grade liquids." },
  { unit: 4, question: "What kind of vessel is a Ro\u2011Ro ship?", options: ["General cargo ship", "Container ship", "Oil tanker", "Vehicle\u2011carrying ship"], correct: 3, explain: "A Ro\u2011Ro ship is a vessel specialized for transporting wheeled vehicles." },
  { unit: 4, question: "Which vessel is designed to carry mixed cargo and can accommodate many different types of goods?", options: ["General cargo ship", "Container ship", "Oil tanker", "Multipurpose vessel"], correct: 3, explain: "A multipurpose vessel is designed for mixed cargo and can handle various types of goods." },
  { unit: 4, question: "What type of vessel is a versatile (multi\u2011purpose) ship?", options: ["General cargo ship", "Container ship", "Oil tanker", "Ship capable of carrying many different cargo types"], correct: 3, explain: "A versatile ship can transport a wide range of cargo types." },
  // ===== Unit 5 · Containerization =====
  { unit: 5, question: "According to the definition in ISO 668:1995, which of the following conditions is a basic requirement for an object to be considered a container?", options: ["It can hold cargo with a maximum weight of 1 tonne", "It is designed for multiple reuse", "It is limited to a single type of cargo", "It must have a volume smaller than 1\u202Fm\xB3"], correct: 1, explain: "ISO 668:1995 defines a container as a permanent transport equipment, strong enough for repeated use and specially designed to facilitate cargo movement without intermediate handling." },
  { unit: 5, question: "Which of the following is a benefit of using containerisation?", options: ["Reduces flexibility in cargo transport", "Increases packaging and shipping costs", "Improves cargo safety and reduces risk", "Slows down the shipping process"], correct: 2, explain: "Containerisation enhances cargo safety by protecting goods inside a sealed container, thereby lowering transport\u2011related risks." },
  { unit: 5, question: "According to the information provided, in which year did Malcolm\u202FMcLean begin using containers in maritime transport?", options: ["1950", "1956", "1960", "1966"], correct: 1, explain: "Malcolm\u202FMcLean introduced containers to sea transport in 1956 when he designed and built the first purpose\u2011built container ships." },
  { unit: 5, question: "Which type of container ship is the largest and can carry the most containers?", options: ["Feeder", "Panamax", "Post\u2011Panamax", "Ultra Large Container Vessel (ULCV)"], correct: 3, explain: "Ultra Large Container Vessels (ULCVs) are the biggest class, with capacities of 14,501\u202FTEU and above." },
  { unit: 5, question: "In container shipping, the terms \u201CFCL\u201D and \u201CLCL\u201D describe two different shipping methods. What does \u201CFCL\u201D stand for?", options: ["Less than Container Load", "Full Container Load", "Feeder Container Load", "Freight Container Load"], correct: 1, explain: "FCL stands for \u201CFull Container Load,\u201D meaning the entire container is used for a single shipper\u2019s cargo." },
  { unit: 5, question: "Which of the following measures is used to ensure the safety of containers on board a vessel?", options: ["Using lashings and locks", "Using a Global Positioning System (GPS) to track container location", "Using unmanned aerial vehicles to monitor containers", "Using satellite positioning devices to track container location"], correct: 0, explain: "Container safety on board is achieved by securing them with lashings and locks to keep them fixed and safe during the voyage." },
  { unit: 5, question: "According to the information provided, what is a \u201CContainer Freight Station (CFS)\u201D?", options: ["A seaport where container ships arrive and depart", "A warehouse where goods are stored before shipment", "A facility where cargo is consolidated, packed and shipped", "A special type of container used for transporting goods"], correct: 2, explain: "A Container Freight Station (CFS) is a facility where cargo is consolidated, packed and prepared for onward transport to its final destination." },
  { unit: 5, question: "In container shipping, \u201CBay\u201D describes the position of a container on a vessel. How is a \u201CBay\u201D defined?", options: ["The position of a container along the length of the ship", "The position of a container along the width of the ship", "The position of a container along the height of the ship", "The position of a container at the seaport"], correct: 0, explain: "A \u201CBay\u201D refers to the location of a container along the ship\u2019s longitudinal axis; containers are arranged in bays for efficient handling." },
  { unit: 5, question: 'According to the provided information, what is a "Gantry Crane (STS)"?', options: ["It is a type of crane used to lift and transport containers on a ship", "It is a type of crane used to lift and transport cargo at a seaport", "It is a type of crane used to lift and transport containers in a warehouse", "It is a type of crane used to lift and transport cargo on land"], correct: 0, explain: "A Gantry Crane (STS) is a crane used to lift and move containers on a vessel, transferring containers between ship and shore." },
  { unit: 5, question: "What does a 20\u2011foot container represent in the TEU measurement system?", options: ["1 TEU", "2 TEU", "0.5 TEU", "0.25 TEU"], correct: 0, explain: "One TEU equals one 20\u2011foot container." },
  { unit: 5, question: "Which type of container is commonly used to transport temperature\u2011controlled goods?", options: ["Dry container", "Reefer container", "Open\u2011Top container", "Flat\u2011Rack container"], correct: 1, explain: "A reefer container is designed for transporting temperature\u2011controlled cargo." },
  { unit: 5, question: "What is the ISO code for a 40\u2011foot high\u2011cube container?", options: ["40HC", "40GP", "40HQ", "40DC"], correct: 0, explain: "The ISO designation for a 40\u2011foot high\u2011cube container is 40HC." },
  { unit: 5, question: "A container that is 20\u202Ffeet long and 8\u202Ffeet\u202F6\u202Finches high is called what?", options: ["20DC", "20GP", "20HC", "20RF"], correct: 1, explain: "A container with those dimensions is designated 20GP." },
  { unit: 5, question: "What information is included in a container identification code?", options: ["Owner code, serial number, and check digit", "Owner code, serial number, and cargo type code", "Owner code, serial number, and country of manufacture code", "Owner code, serial number, and weight code"], correct: 0, explain: "A container identification code consists of the owner code, serial number, and a check digit." },
  { unit: 5, question: "What is the standard width of a container?", options: ["8\u202Ffeet", "8\u202Ffeet\u202F6\u202Finches", "9\u202Ffeet", "9\u202Ffeet\u202F6\u202Finches"], correct: 0, explain: "The standard container width is 8\u202Ffeet." },
  { unit: 5, question: "What is the maximum gross weight of a 20\u2011foot container?", options: ["24,000\u202Fkg", "30,400\u202Fkg", "35,000\u202Fkg", "40,000\u202Fkg"], correct: 1, explain: "The maximum gross weight for a 20\u2011foot container is 30,400\u202Fkg." },
  { unit: 5, question: "Which type of container is commonly used to transport oversized cargo?", options: ["Dry container", "Reefer container", "Open Top container", "Flat Rack container"], correct: 2, explain: "Open Top containers are typically used for transporting oversized cargo." },
  { unit: 5, question: "What is the purpose of a container identification code?", options: ["To identify the owner of the container", "To identify the type of cargo in the container", "To identify the weight of the container", "To identify the size of the container"], correct: 0, explain: "The container identification code is used to determine the owner of the container." },
  { unit: 5, question: "Why is checking the container identification code important?", options: ["To determine the owner of the container", "To determine the type of cargo in the container", "To determine the weight of the container", "To avoid confusion during container handling"], correct: 3, explain: "The importance of checking the container identification code is to avoid confusion when handling containers." },
  { unit: 5, question: "When loading cargo into a container, which factor is most critical for ensuring the safety of both the cargo and the container?", options: ["Cargo weight", "Cargo dimensions", "Cargo packaging", "The balance of the cargo inside the container"], correct: 3, explain: "Cargo packaging is the most critical factor for safety, as it prevents cargo movement during transport and reduces damage risk." },
  { unit: 5, question: "Why is it important to inspect a container before loading cargo?", options: ["To ensure the container is large enough for the cargo", "To ensure the container is clean and dry", "To ensure the container is not damaged or structurally compromised", "To ensure the container has all required documents and certifications"], correct: 2, explain: "Inspecting the container before loading ensures it is clean and dry, which prevents mold growth and cargo damage." },
  { unit: 5, question: "Which of the following is NOT part of the container loading process?", options: ["Inspect the container before loading", "Package the cargo", "Use dunnage to prevent cargo movement", "Transport the cargo to the delivery site"], correct: 3, explain: "Using dunnage is part of the loading process, but transporting the cargo to the delivery site is not." },
  { unit: 5, question: "Why is the use of dunnage in a container important?", options: ["To prevent cargo movement during transport", "To reduce the risk of cargo damage", "To improve the balance of cargo within the container", "To reduce the weight of the cargo"], correct: 0, explain: "Dunnage prevents cargo movement during transport, thereby reducing damage risk and ensuring cargo safety." },
  { unit: 5, question: "Which factor affects the balance of cargo within a container?", options: ["Cargo weight", "Cargo dimensions", "Cargo packaging", "The distribution of cargo inside the container"], correct: 3, explain: "The distribution of cargo inside the container influences balance, ensuring even placement and preventing imbalance." },
  { unit: 5, question: "Why is inspecting cargo before loading it into a container important?", options: ["To ensure the cargo is large enough to fit in the container", "To ensure the cargo is clean and dry", "To ensure the cargo is not damaged or has quality issues", "To ensure the cargo has all required documents and certificates"], correct: 2, explain: "Inspecting cargo before loading it into a container ensures it is not damaged or has quality problems, reducing the risk of damage during transport." },
  { unit: 5, question: "Which of the following is NOT part of the process of completing container loading?", options: ["Inspecting the cargo and the container", "Completing the necessary documents and paperwork", "Loading and sealing the container", "Transporting the cargo to the delivery location"], correct: 3, explain: "Transporting the cargo to the delivery location is not part of completing the container loading process; it is a separate step in the overall shipping workflow." },
  { unit: 5, question: "Why is the use of mechanical equipment important during container loading?", options: ["To minimize the risk of cargo damage", "To improve the balance of cargo inside the container", "To reduce the weight of the cargo", "To increase the speed and efficiency of the loading process"], correct: 3, explain: "Using mechanical equipment speeds up and makes the loading process more efficient, thereby reducing handling time and transportation costs." },
  { unit: 5, question: "Which factor below affects the safety of cargo during transportation?", options: ["Cargo weight", "Cargo dimensions", "Cargo packaging", "The balance of cargo inside the container"], correct: 2, explain: "Cargo packaging affects safety during transport because it prevents cargo movement and reduces the risk of damage." },
  // ===== Unit 6 · Shipping Documents =====
  { unit: 6, question: "When receiving a Booking Note from a client, which information must the operations staff verify to avoid errors on the Bill of Lading?", options: ["Ship name and voyage number, together with the estimated time of arrival (ETA) and departure (ETD)", "Detailed description of the company's internal procedures and the client\u2019s tax identification number", "Number of staff working at the port of loading and their holiday schedule", "Email address of the client\u2019s bank representative"], correct: 0, explain: "The Booking Note must contain ship, voyage, ETA/ETD data because these are copied onto the B/L; the other details do not directly affect the B/L." },
  { unit: 6, question: "A Bill of Lading is marked \u201CClean\u201D but the cargo was actually damaged during transport. When the bank asks for proof, which document provides the strongest evidence of the cargo\u2019s condition?", options: ["Mate\u2019s Receipt noting the cargo condition at loading", "Packing List prepared by the shipper", "Letter of Indemnity (LOI) signed by the shipper", "Delivery Order issued at the destination port"], correct: 0, explain: "The Mate\u2019s Receipt records the cargo condition at the time of loading, making it the most important evidence in a damage dispute, outweighing the Packing List or LOI." },
  { unit: 6, question: "In a letter of credit transaction, the bank agrees to accept only a \u201CClean Bill of Lading.\u201D The buyer submits a \u201CClaused Bill of Lading\u201D (showing damage). Which action best satisfies the bank\u2019s requirement?", options: ["Ask the carrier to issue a new \u201CClean\u201D Bill of Lading after the cargo is repaired", "Attach a Letter of Indemnity to protect the bank", "Provide a copy of the Sea Waybill instead of a Bill of Lading", "Make payment before the bank reviews the B/L"], correct: 0, explain: "The bank requires a clean B/L; therefore the carrier must issue a new B/L without any clauses. An LOI does not replace a clean B/L, and a Sea Waybill does not serve as a title document." },
  { unit: 6, question: "An NVOCC issues a House Bill of Lading to a client. When the cargo arrives at the destination port, who has the authority to decide delivery to the final consignee?", options: ["The holder of the Master Bill of Lading issued by the shipping line", "The holder of the House Bill of Lading issued by the NVOCC", "The person who signs the Shipping Instructions at the port", "The person possessing the Certificate of Origin for the goods"], correct: 0, explain: "The holder of the Master Bill of Lading issued by the carrier decides delivery, as cargo is released only after the carrier confirms ownership based on the Master B/L." },
  { unit: 6, question: "In a commercial transaction, the seller wants to retain ownership of the goods until the buyer pays. Which type of Bill of Lading is most suitable?", options: ["Negotiable (Order) Bill of Lading", "Non\u2011Negotiable (Straight) Bill of Lading", "Bearer Bill of Lading", "Sea Waybill"], correct: 0, explain: "A negotiable (order) B/L allows the transfer of ownership through endorsement, protecting the seller\u2019s title until the goods are delivered." },
  { unit: 6, question: "A shipment is transported under a Multimodal Bill of Lading. Which statement is NOT a characteristic of this type of B/L?", options: ["It includes information on the various transport modes (rail, road, etc.)", "It can be used as a documentary proof for a bank in an L/C", "It only serves as a receipt of goods and does not function as a title document", "It is issued by the main carrier even when multiple carriers are involved"], correct: 2, explain: "A multimodal B/L remains a title document; only a Sea Waybill lacks title function. The other statements are correct." },
  { unit: 6, question: "When a Bill of Lading is marked \u201CStale\u201D in an L/C transaction, the bank will usually:", options: ["Reject it and request a new B/L", "Accept it if it bears the seller\u2019s signature", "Ask for a Letter of Indemnity", "Accept it if the B/L is marked \u201CClean\u201D"], correct: 0, explain: "A stale B/L exceeds the presentation period stipulated in the L/C, so the bank typically rejects it and asks for a new one." },
  { unit: 6, question: "In a charter party arrangement, which Bill of Lading is issued to reflect the transport contract?", options: ["Charter Party Bill of Lading", "House Bill of Lading", "Sea Waybill", "Electronic Bill of Lading"], correct: 0, explain: "A Charter Party Bill of Lading is issued based on the charter party contract, reflecting its specific terms." },
  { unit: 6, question: "A hazardous cargo is being shipped. Which of the following documents is mandatory and provides detailed information on the hazard class, UN number, and safety measures?", options: ["Dangerous Goods Declaration", "Packing List", "Commercial Invoice", "Statement of Facts"], correct: 0, explain: "The Dangerous Goods Declaration is required for hazardous cargo and contains the class, UN number, and safety instructions." },
  { unit: 6, question: "If a carrier wants to deliver cargo without requiring the consignee to present the original Bill of Lading, which document type will they use?", options: ["Surrendered Bill of Lading", "Clean Bill of Lading", "Bearer Bill of Lading", "Sea Waybill"], correct: 0, explain: "A surrendered B/L allows the original to be handed to the carrier in exchange for delivery without presenting the original at the port." },
  { unit: 6, question: 'In an export transaction, the customer asks the carrier to provide an "Electronic Bill of Lading." The main advantage of an e\u2011B/L over a paper B/L is:', options: ["Reduces transmission time and the risk of losing the original", "Allows the consignee to sign electronically on a paper copy", "Does not require the carrier's signature", "Can replace a Sea Waybill in all cases"], correct: 0, explain: "An e\u2011B/L shortens transmission time and eliminates the risk of losing the original because it is transmitted electronically; it still requires an electronic signature and does not replace a Sea Waybill in every situation." },
  // ===== Unit 7 · Sea Shipping Services =====
  { unit: 7, question: "A sea freight company provides cargo transportation services on a fixed schedule with published rates. Which type of sea shipping service is this?", options: ["Liner shipping", "Tramp shipping", "Feeder service", "Consortium"], correct: 0, explain: "Liner shipping is the service that offers cargo transport on a fixed schedule with published rates." },
  { unit: 7, question: "What purpose does a booking note serve in sea freight?", options: ["It is the official shipping contract", "It is the confirmation of a space reservation on a vessel", "It is the freight invoice", "It is an export document"], correct: 1, explain: "A booking note is the confirmation of a space reservation on a vessel, confirming that cargo space has been secured for the shipper." },
  { unit: 7, question: "What type of sea shipping is tramp shipping?", options: ["Transporting cargo on a fixed schedule", "Transporting cargo without a fixed schedule", "Transporting cargo on a market vessel", "Transporting cargo on a specialized vessel"], correct: 1, explain: "Tramp shipping transports cargo without a fixed schedule; the vessel is hired to move goods from one port to another without a set timetable." },
  { unit: 7, question: "What is a Charter Party?", options: ["It is a contract for sea cargo transportation", "It is a ship\u2011hire contract", "It is a cargo insurance contract", "It is an export contract"], correct: 1, explain: "A Charter Party is a ship\u2011hire contract that sets the terms and conditions for chartering a vessel to transport cargo." },
  { unit: 7, question: "What kind of charter is a Voyage Charter?", options: ["Hiring a vessel to carry cargo on a fixed route", "Hiring a vessel to carry cargo on a non\u2011fixed route", "Hiring a vessel to carry cargo for a fixed period of time", "Hiring a vessel to carry cargo without any route or time restrictions"], correct: 1, explain: "A Voyage Charter hires a vessel to transport cargo on a non\u2011fixed route, moving goods from one port to another without a set schedule." },
  { unit: 7, question: "What kind of charter is a Time Charter?", options: ["Hiring a vessel to carry cargo on a fixed route", "Hiring a vessel to carry cargo on a non\u2011fixed route", "Hiring a vessel to carry cargo for a fixed period of time", "Hiring a vessel to carry cargo without any route or time restrictions"], correct: 2, explain: "A Time Charter hires a vessel to transport cargo for a specified period of time." },
  { unit: 7, question: "What kind of charter is a Bareboat Charter?", options: ["Hiring a vessel to carry cargo on a fixed route", "Hiring a vessel to carry cargo on a non\u2011fixed route", "Hiring a vessel to carry cargo for a fixed period of time without crew", "Hiring a vessel to carry cargo without any route or time restrictions"], correct: 2, explain: "A Bareboat Charter hires a vessel for a fixed period without crew; the charterer must provide crew and manage the ship." },
  { unit: 7, question: "Who is a shipowner?", options: ["The charterer", "The shipowner", "The cargo carrier", "The cargo insurer"], correct: 1, explain: "A shipowner is the owner of the vessel who leases it out for cargo transportation." },
  { unit: 7, question: "Who is the charterer?", options: ["The party who hires a vessel", "The party who leases a vessel", "The party that transports cargo", "The party that insures cargo"], correct: 0, explain: "The charterer is the party that hires a vessel to transport cargo." },
  { unit: 7, question: "Who is a shipbroker?", options: ["The party who hires a vessel", "The party who leases a vessel", "The party that transports cargo", "The intermediary between the charterer and the vessel owner"], correct: 3, explain: "A shipbroker acts as the intermediary between the charterer and the vessel owner, facilitating negotiations and connections." },
  { unit: 7, question: "How do liner shipping and tramp shipping differ?", options: ["Liner shipping follows a fixed schedule, whereas tramp shipping operates without a fixed schedule", "Liner shipping operates without a fixed schedule, whereas tramp shipping follows a fixed schedule", "Liner shipping uses bulk carriers, whereas tramp shipping uses specialized vessels", "Liner shipping uses specialized vessels, whereas tramp shipping uses bulk carriers"], correct: 0, explain: "Liner shipping follows a fixed schedule, while tramp shipping does not operate on a fixed schedule." },
  { unit: 7, question: "What is a Vessel Sharing Agreement (VSA)?", options: ["An agreement among shipping lines to share vessels and coordinate operations on specific routes", "An agreement among shipping lines to compete with each other", "An agreement among shipping lines to cooperate in insurance matters", "An agreement among shipping lines to invest in new projects"], correct: 0, explain: "A Vessel Sharing Agreement (VSA) is an arrangement where shipping lines share vessels and coordinate operations on designated routes." },
  { unit: 7, question: "What is an alliance?", options: ["An agreement among shipping lines to cooperate and share vessels", "An agreement among shipping lines to compete with each other", "An agreement among shipping lines to cooperate in insurance matters", "An agreement among shipping lines to invest in new projects"], correct: 0, explain: "An alliance is an agreement among shipping lines to cooperate and share vessels, enhancing efficiency and reducing operating costs." },
  { unit: 7, question: "What is a consortium?", options: ["An agreement among shipping lines to cooperate and share vessels", "An agreement among shipping lines to compete with each other", "An agreement among shipping lines to cooperate in insurance matters", "An agreement among shipping lines to invest in new projects"], correct: 0, explain: "A consortium is an agreement among shipping lines to cooperate and share vessels, aiming to improve efficiency and lower operating costs." },
  // ===== Unit 8 · Completing a Freight Forwarding Order =====
  { unit: 8, question: "In the export process, which step is the first after signing a contract with the customer?", options: ["Apply for an export license", "Book and obtain an empty container", "Prepare the export goods and inspect them", "Purchase transport insurance"], correct: 0, explain: "After signing the contract, the company must apply for an export license (if required) before proceeding with the next steps." },
  { unit: 8, question: "When preparing a Packing List for a container shipment, which of the following pieces of information is NOT required?", options: ["Quantity, net weight and total weight of each package", "HS (Harmonized System) code of the goods", "Name and address of the final buyer", "Dimensions and special markings on the packaging"], correct: 1, explain: "A Packing List only lists the physical details of the packages (quantity, weight, dimensions, markings); the HS code is not mandatory on the Packing List." },
  { unit: 8, question: "Which two documents below are commonly used to prove the origin of goods and can be replaced by an eCO?", options: ["Bill of Lading and Packing List", "Certificate of Origin and Commercial Invoice", "Certificate of Origin and Packing List", "Certificate of Origin and Bill of Lading"], correct: 1, explain: "The Certificate of Origin (CO) proves origin; the eCO is the electronic version of the CO. A Commercial Invoice is usually attached to provide value and description of the goods." },
  { unit: 8, question: "In the import process, which step is the final one before the goods are delivered to the importer?", options: ["Customs declaration and tax payment", "Opening and clearing the customs entry", "Deliver the goods to the warehouse and return the empty container", "File storage and document archiving"], correct: 2, explain: "After completing customs formalities, the goods are moved to the warehouse and the empty container is returned; this is the last step before handing the goods over to the importer." },
  { unit: 8, question: "A Shipper\u2019s Letter of Instruction (SLI) is typically used to:", options: ["Confirm bank payment to the seller", "Instruct the freight forwarder on shipping requirements and documentation", "Provide a certificate of origin for customs", "Register the HS code for the goods"], correct: 1, explain: "The SLI is a detailed instruction to the freight forwarder on how to ship, pack, and which documents to include." },
  { unit: 8, question: 'Among the three types of Bill of Lading (Inland, Ocean, Airway), which is usually referred to as "non\u2011negotiable" and transmitted via EDI?', options: ["Inland Bill of Lading", "Ocean Bill of Lading", "Airway Bill", "Sea Waybill"], correct: 3, explain: "A Sea Waybill is a non\u2011negotiable Bill of Lading and is commonly transmitted electronically through EDI." },
  { unit: 8, question: "If a shipment contains hazardous materials, which document must be completed by a person with a special training certification?", options: ["Packing List", "Certificate of Origin", "Shipper\u2019s Declaration for Dangerous Goods", "Commercial Invoice"], correct: 2, explain: "The Shipper\u2019s Declaration for Dangerous Goods (IATA or IMO) requires the declarant to be trained in handling hazardous goods." },
  { unit: 8, question: "In the export process, at which stage is transport insurance usually purchased?", options: ["After the goods have been submitted for customs declaration", "Before signing a contract with the customer", "After the container has been booked and before the goods are loaded onto the vessel", "After the goods have arrived at the destination port"], correct: 2, explain: "Insurance is typically bought after the container is booked but before the goods are loaded onto the vessel to cover risks during transport." },
  { unit: 8, question: "How does a Proforma Invoice differ from a Commercial Invoice?", options: ["A Proforma Invoice does not include the product's HS code", "A Proforma Invoice is only used for quotation and has no accounting value", "A Proforma Invoice does not require Incoterms information", "A Proforma Invoice is always issued after the goods have been delivered"], correct: 1, explain: "A Proforma Invoice is a quotation document, not an official accounting document; a Commercial Invoice is the actual payment document." },
  // ===== Unit 9 · Sea Freight Pricing =====
  { unit: 9, question: "When calculating sea freight rates in liner shipping, the rate unit is usually based on what?", options: ["Weight (kg) of the cargo", "Size (TEU/FEU) of the container", "Specific type of cargo", "Distance from the loading port to the discharge port"], correct: 1, explain: "In liner shipping, the rate unit is typically based on the container size (TEU/FEU)." },
  { unit: 9, question: "What is the BAF (Bunker Adjustment Factor) surcharge in sea freight?", options: ["Fuel price adjustment surcharge", "Port charge adjustment surcharge", "Cargo price adjustment surcharge", "Transportation price adjustment surcharge"], correct: 0, explain: "BAF is a surcharge that adjusts the freight rate based on fuel prices." },
  { unit: 9, question: "Which Incoterm obligates the seller to bear costs and risks until the goods are delivered on board the vessel at the loading port?", options: ["FOB (Free On Board)", "CFR (Cost and Freight)", "CIF (Cost, Insurance and Freight)", "EXW (Ex Works)"], correct: 0, explain: "FOB requires the seller to assume cost and risk up to the point the goods are placed on board the vessel at the loading port." },
  { unit: 9, question: "What does laytime refer to in a voyage charter?", options: ["The time for loading and unloading at the port", "The vessel\u2019s sailing time between ports", "The waiting time at the port", "The time for loading and unloading at a warehouse"], correct: 0, explain: "Laytime is the period allowed for loading and unloading cargo at the port." },
  { unit: 9, question: "What is demurrage in a voyage charter?", options: ["A surcharge paid to the shipowner when the vessel must wait at the port", "A surcharge paid to the charterer when the vessel must wait at the port", "A surcharge paid to the cargo owner for delayed delivery", "A surcharge paid to the carrier for delayed delivery"], correct: 1, explain: "Demurrage is a charge to the shipowner when the vessel is delayed at the port because the charterer cannot load or unload on time." },
  { unit: 9, question: "What is despatch in a voyage charter?", options: ["A surcharge paid to the shipowner when the vessel must wait at the port", "A surcharge paid to the charterer when the vessel must wait at the port", "A surcharge paid to the cargo owner for delayed delivery", "A surcharge paid to the carrier for delayed delivery"], correct: 0, explain: "Despatch is a reward paid to the charterer when they complete loading or unloading ahead of schedule." },
  { unit: 9, question: "What is a Statement of Facts (SOF) in a voyage charter?", options: ["A detailed declaration of the cargo", "A detailed declaration of loading and unloading times", "A detailed declaration of the vessel and crew", "A detailed declaration of the port and equipment"], correct: 1, explain: "The Statement of Facts records the exact loading and unloading times and is used to calculate laytime and demurrage." },
  { unit: 9, question: "What does detention mean in a voyage charter?", options: ["Waiting time at the port", "Loading and unloading time at the port", "The vessel\u2019s sailing time between ports", "The period the vessel is held at the port due to the charterer"], correct: 3, explain: "Detention is the time the vessel is held at the port because the charterer fails to load or unload on schedule." },
  { unit: 9, question: "What is a tramp freight rate?", options: ["The sea freight charge for a specific shipment", "The sea freight charge for a specific type of cargo", "The sea freight charge for a specific route", "The sea freight charge for a specific period"], correct: 0, explain: "A tramp freight rate is the sea freight charge for a particular shipment, typically applied to spot or specialized vessels." },
  { unit: 9, question: "What is a time charter hire?", options: ["The vessel rental price for a specific shipment", "The vessel rental price for a specific period", "The vessel rental price for a specific type of cargo", "The vessel rental price for a specific route"], correct: 1, explain: "Time charter hire is the vessel rental price for a defined period, usually used when a ship is chartered to transport cargo for a set time." },
  { unit: 9, question: "What is a bareboat charter hire?", options: ["The vessel rental price for a specific shipment", "The vessel rental price for a specific period", "The rental price for a bareboat (excluding crew, fuel, insurance)", "The vessel rental price for a specific type of cargo"], correct: 2, explain: "Bareboat charter hire is the rental price for a bareboat, without crew, fuel, or insurance, commonly used for long\u2011term cargo transport." },
  { unit: 9, question: "What does market dynamics in sea transport refer to?", options: ["Changes in sea freight rates", "Changes in demand for sea transport", "Changes in supply and demand in sea transport", "Changes in sea transport policies"], correct: 2, explain: "Market dynamics in sea transport denote changes in supply and demand, encompassing freight rates, demand, and service provision." },
  { unit: 9, question: "What factors affect tramp freight rates?", options: ["Sea transport demand, service supply, fuel prices", "Sea transport demand, service supply, cargo prices", "Sea transport demand, service supply, transport policies", "Sea transport demand, service supply, weather"], correct: 0, explain: "Factors influencing tramp freight rates include sea transport demand, service supply, and fuel prices." }
];
const ALL_Q = withIds(QUIZ_BANK);
const UNIT_LIST = Array.from(new Set(ALL.map((c) => c.unit))).sort((a, b) => a - b);
const MODES = [
  { key: "flash", label: "Th\u1EBB ghi nh\u1EDB" },
  { key: "match", label: "Gh\xE9p th\u1EBB" },
  { key: "quiz", label: "Tr\u1EAFc nghi\u1EC7m" },
  { key: "list", label: "Danh s\xE1ch \xF4n" }
];
function Flashcard({ cards }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => /* @__PURE__ */ new Set());
  useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [cards]);
  const go = useCallback((d) => {
    setFlipped(false);
    setIdx((i) => (i + d + cards.length) % cards.length);
  }, [cards.length]);
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);
  if (!cards.length) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Kh\xF4ng c\xF3 th\u1EBB n\xE0o.");
  const card = cards[idx];
  const toggleKnown = () => {
    setKnown((prev) => {
      const n = new Set(prev);
      n.has(card.id) ? n.delete(card.id) : n.add(card.id);
      return n;
    });
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "progress" }, /* @__PURE__ */ React.createElement("i", { style: { width: (idx + 1) / cards.length * 100 + "%" } })), /* @__PURE__ */ React.createElement("div", { className: "center", style: { margin: "8px 0", fontSize: 13, color: "var(--muted)" } }, "\u0110\xE3 \u0111\xE1nh d\u1EA5u thu\u1ED9c: ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ok)" } }, known.size), " / ", cards.length), /* @__PURE__ */ React.createElement("div", { className: "fc-scene" }, /* @__PURE__ */ React.createElement("div", { className: "fc" + (flipped ? " flipped" : ""), onClick: () => setFlipped((f) => !f) }, /* @__PURE__ */ React.createElement("div", { className: "fc-face fc-front" }, /* @__PURE__ */ React.createElement("span", { className: "fc-tag" }, "Unit ", card.unit, " \xB7 Thu\u1EADt ng\u1EEF"), /* @__PURE__ */ React.createElement("div", { className: "fc-term" }, card.term), /* @__PURE__ */ React.createElement("span", { className: "fc-hint" }, "B\u1EA5m \u0111\u1EC3 l\u1EADt \xB7 ph\xEDm Space")), /* @__PURE__ */ React.createElement("div", { className: "fc-face fc-back" }, /* @__PURE__ */ React.createElement("span", { className: "fc-tag" }, "Gi\u1EA3i ngh\u0129a"), /* @__PURE__ */ React.createElement("div", { className: "fc-def" }, card.def), /* @__PURE__ */ React.createElement("span", { className: "fc-hint" }, "B\u1EA5m \u0111\u1EC3 l\u1EADt l\u1EA1i")))), /* @__PURE__ */ React.createElement("div", { className: "fc-nav" }, /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => go(-1) }, "\u2190 Tr\u01B0\u1EDBc"), /* @__PURE__ */ React.createElement("span", { className: "counter" }, idx + 1, " / ", cards.length), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => go(1) }, "Sau \u2192")), /* @__PURE__ */ React.createElement("div", { className: "center", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "btn " + (known.has(card.id) ? "gold" : ""), onClick: toggleKnown }, known.has(card.id) ? "\u2713 \u0110\xE3 thu\u1ED9c th\u1EBB n\xE0y" : "\u0110\xE1nh d\u1EA5u \u0111\xE3 thu\u1ED9c")));
}
const BATCH = 5;
function Matching({ cards }) {
  const [round, setRound] = useState(0);
  const [batch, setBatch] = useState([]);
  const [rights, setRights] = useState([]);
  const [sel, setSel] = useState(null);
  const [matched, setMatched] = useState(/* @__PURE__ */ new Set());
  const [wrong, setWrong] = useState(null);
  const [done, setDone] = useState(0);
  const newRound = useCallback(() => {
    const pick = shuffle(cards).slice(0, Math.min(BATCH, cards.length));
    setBatch(pick);
    setRights(shuffle(pick));
    setSel(null);
    setMatched(/* @__PURE__ */ new Set());
    setWrong(null);
  }, [cards]);
  useEffect(() => {
    newRound();
    setDone(0);
  }, [newRound]);
  useEffect(() => {
    if (round) newRound();
  }, [round]);
  if (cards.length < 2) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "C\u1EA7n \xEDt nh\u1EA5t 2 th\u1EBB \u0111\u1EC3 gh\xE9p. H\xE3y ch\u1ECDn th\xEAm Unit.");
  const clickTerm = (c) => {
    if (!matched.has(c.id)) setSel(c.id);
  };
  const clickDef = (c) => {
    if (matched.has(c.id) || sel == null) return;
    if (c.id === sel) {
      const n = new Set(matched);
      n.add(c.id);
      setMatched(n);
      setSel(null);
      if (n.size === batch.length) setDone((d) => d + 1);
    } else {
      setWrong(c.id);
      setTimeout(() => setWrong(null), 320);
      setSel(null);
    }
  };
  const allDone = matched.size === batch.length && batch.length > 0;
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "toolbar", style: { justifyContent: "space-between", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--muted)" } }, "Gh\xE9p \u0111\xFAng: ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ok)" } }, matched.size), " / ", batch.length, "\xA0\xB7\xA0 L\u01B0\u1EE3t ho\xE0n th\xE0nh: ", /* @__PURE__ */ React.createElement("b", null, done)), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => setRound((r) => r + 1) }, "\u21BB L\u01B0\u1EE3t m\u1EDBi")), allDone && /* @__PURE__ */ React.createElement("div", { className: "q-question", style: { background: "var(--ok)", padding: 16 } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700 } }, "\u{1F389} Ho\xE0n th\xE0nh! B\u1EA5m \u201CL\u01B0\u1EE3t m\u1EDBi\u201D \u0111\u1EC3 ti\u1EBFp t\u1EE5c.")), /* @__PURE__ */ React.createElement("div", { className: "match-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "col-title" }, "Thu\u1EADt ng\u1EEF"), batch.map((c) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: "t" + c.id,
      className: "m-item term" + (matched.has(c.id) ? " matched" : "") + (sel === c.id ? " sel" : ""),
      onClick: () => clickTerm(c)
    },
    matched.has(c.id) ? "\u2713 " : "",
    c.term
  ))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "col-title" }, "Gi\u1EA3i ngh\u0129a"), rights.map((c) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: "d" + c.id,
      className: "m-item" + (matched.has(c.id) ? " matched" : "") + (wrong === c.id ? " wrong" : ""),
      onClick: () => clickDef(c)
    },
    c.def
  )))));
}
function shuffleOptions(q) {
  const idxs = shuffle(q.options.map((_, i) => i));
  const options = idxs.map((i) => q.options[i]);
  const correctIndex = idxs.indexOf(q.correct);
  return { ...q, options, correctIndex };
}
const LETTERS = ["A", "B", "C", "D"];
function Quiz({ questions }) {
  const [order, setOrder] = useState([]);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const reset = useCallback(() => {
    setOrder(shuffle(questions));
    setQi(0);
    setPicked(null);
    setScore(0);
    setAnswered(0);
  }, [questions]);
  useEffect(() => {
    reset();
  }, [reset]);
  const question = useMemo(() => {
    if (!order.length) return null;
    return shuffleOptions(order[qi % order.length]);
  }, [order, qi]);
  if (!questions.length) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Ch\u01B0a c\xF3 c\xE2u h\u1ECFi cho l\u1EF1a ch\u1ECDn n\xE0y. H\xE3y ch\u1ECDn th\xEAm Unit.");
  if (!question) return null;
  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    setAnswered((a) => a + 1);
    if (i === question.correctIndex) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setQi((i) => i + 1);
  };
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "toolbar", style: { justifyContent: "space-between", marginBottom: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: "var(--muted)" } }, "\u0110i\u1EC3m: ", /* @__PURE__ */ React.createElement("b", { style: { color: "var(--ok)" } }, score), " / ", answered, " c\xE2u"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: reset }, "\u21BB L\xE0m l\u1EA1i")), /* @__PURE__ */ React.createElement("div", { className: "q-question" }, /* @__PURE__ */ React.createElement("div", { className: "q-tag" }, "Unit ", question.unit, " \xB7 C\xE2u h\u1ECFi tr\u1EAFc nghi\u1EC7m"), /* @__PURE__ */ React.createElement("div", { className: "q-text" }, question.question)), question.options.map((opt, i) => {
    let cls = "q-opt";
    if (picked !== null) {
      if (i === question.correctIndex) cls += " correct";
      else if (i === picked) cls += " wrong";
    }
    return /* @__PURE__ */ React.createElement("button", { key: i, className: cls, disabled: picked !== null, onClick: () => choose(i) }, /* @__PURE__ */ React.createElement("b", null, LETTERS[i], "."), " ", opt);
  }), picked !== null && /* @__PURE__ */ React.createElement("div", { className: "q-explain" }, picked === question.correctIndex ? "\u2713 Ch\xEDnh x\xE1c \u2014 " : "\u2717 Ch\u01B0a \u0111\xFAng \u2014 ", question.explain), picked !== null && /* @__PURE__ */ React.createElement("div", { className: "center", style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("button", { className: "btn gold", onClick: next }, "C\xE2u ti\u1EBFp theo \u2192")));
}
function ListView({ cards }) {
  const byUnit = useMemo(() => {
    const m = {};
    cards.forEach((c) => {
      (m[c.unit] = m[c.unit] || []).push(c);
    });
    return m;
  }, [cards]);
  const units = Object.keys(byUnit).map(Number).sort((a, b) => a - b);
  if (!cards.length) return /* @__PURE__ */ React.createElement("div", { className: "empty" }, "Kh\xF4ng c\xF3 th\u1EBB n\xE0o.");
  return /* @__PURE__ */ React.createElement("div", null, units.map((u) => /* @__PURE__ */ React.createElement("div", { key: u }, /* @__PURE__ */ React.createElement("div", { className: "unit-head" }, "Unit ", u, " \xB7 ", UNIT_TITLES[u], " (", byUnit[u].length, ")"), byUnit[u].map((c) => /* @__PURE__ */ React.createElement("div", { key: c.id, className: "list-item" }, /* @__PURE__ */ React.createElement("div", { className: "list-term" }, c.term), /* @__PURE__ */ React.createElement("div", { className: "list-def" }, c.def))))));
}
function App() {
  const [mode, setMode] = useState("flash");
  const [unit, setUnit] = useState("all");
  const [doShuffle, setDoShuffle] = useState(true);
  const cards = useMemo(() => {
    let c = unit === "all" ? ALL : ALL.filter((x) => x.unit === unit);
    if (doShuffle && mode !== "list") c = shuffle(c);
    return c;
  }, [unit, doShuffle, mode]);
  const questions = useMemo(() => {
    return unit === "all" ? ALL_Q : ALL_Q.filter((x) => x.unit === unit);
  }, [unit]);
  const countForUnit = (u) => ALL.filter((c) => c.unit === u).length;
  return /* @__PURE__ */ React.createElement("div", { className: "wrap" }, /* @__PURE__ */ React.createElement("header", { className: "app" }, /* @__PURE__ */ React.createElement("div", { className: "logo" }, "\u{1F6A2}"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h1", null, "GSF301 \xB7 \xD4n t\u1EADp Sea Freight Forwarding"), /* @__PURE__ */ React.createElement("p", null, "Flashcard \xB7 Gh\xE9p th\u1EBB \xB7 Tr\u1EAFc nghi\u1EC7m \xB7 Danh s\xE1ch \u2014 b\xE1m s\xE1t 9 Chapter")), /* @__PURE__ */ React.createElement("div", { className: "stat" }, ALL.length, " th\u1EBB", /* @__PURE__ */ React.createElement("br", null), UNIT_LIST.length, " Unit")), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Ch\u1EBF \u0111\u1ED9 h\u1ECDc"), /* @__PURE__ */ React.createElement("div", { className: "chips" }, MODES.map((m) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: m.key,
      className: "chip mode" + (mode === m.key ? " active" : ""),
      onClick: () => setMode(m.key)
    },
    m.label
  )))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Ch\u1ECDn ch\u01B0\u01A1ng"), /* @__PURE__ */ React.createElement("div", { className: "chips", style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("div", { className: "chip" + (unit === "all" ? " active" : ""), onClick: () => setUnit("all") }, "T\u1EA5t c\u1EA3 ", /* @__PURE__ */ React.createElement("span", { className: "badge" }, ALL.length)), UNIT_LIST.map((u) => /* @__PURE__ */ React.createElement("div", { key: u, className: "chip" + (unit === u ? " active" : ""), onClick: () => setUnit(u) }, "Unit ", u, " ", /* @__PURE__ */ React.createElement("span", { className: "badge" }, countForUnit(u))))), /* @__PURE__ */ React.createElement("div", { className: "toolbar" }, /* @__PURE__ */ React.createElement("div", { className: "toggle", onClick: () => setDoShuffle((s) => !s) }, /* @__PURE__ */ React.createElement("span", { className: "switch" + (doShuffle ? " on" : "") }, /* @__PURE__ */ React.createElement("b", null)), "Tr\u1ED9n ng\u1EABu nhi\xEAn (shuffle)"), unit !== "all" && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--muted)", marginLeft: "auto" } }, "\u0110ang \xF4n: ", /* @__PURE__ */ React.createElement("b", null, "Unit ", unit), " \u2014 ", UNIT_TITLES[unit]))), /* @__PURE__ */ React.createElement("div", { className: "panel" }, mode === "flash" && /* @__PURE__ */ React.createElement(Flashcard, { cards }), mode === "match" && /* @__PURE__ */ React.createElement(Matching, { cards }), mode === "quiz" && /* @__PURE__ */ React.createElement(Quiz, { questions }), mode === "list" && /* @__PURE__ */ React.createElement(ListView, { cards })), /* @__PURE__ */ React.createElement("footer", null, "H\u1ECDc li\u1EC7u t\u1EF1 so\u1EA1n t\u1EEB t\xE0i li\u1EC7u GSF301 \u2014 Sea Freight Forwarding \xB7 Ch\xFAc \xF4n thi t\u1ED1t! \u{1F6A2}"));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
