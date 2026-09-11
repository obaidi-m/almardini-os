-- Store nationality as the country name, not the adjective.
--
-- UI still labels the field "Nationality"; the value inside is now the
-- country ("Saudi Arabia", "Yemen") rather than the adjective ("Saudi",
-- "Yemeni"). Translation to other languages happens at render time later
-- via a lookup table; the DB stores the canonical English country name.
--
-- Rows whose current value is not a known adjective are left unchanged so
-- any hand-typed entries survive review instead of being clobbered.

begin;

with mapping(adjective, country) as (
  values
    ('Afghan','Afghanistan'), ('Albanian','Albania'), ('Algerian','Algeria'),
    ('American','United States'), ('Andorran','Andorra'), ('Angolan','Angola'),
    ('Argentine','Argentina'), ('Argentinian','Argentina'), ('Armenian','Armenia'),
    ('Australian','Australia'), ('Austrian','Austria'), ('Azerbaijani','Azerbaijan'),
    ('Bahamian','Bahamas'), ('Bahraini','Bahrain'), ('Bangladeshi','Bangladesh'),
    ('Barbadian','Barbados'), ('Belarusian','Belarus'), ('Belgian','Belgium'),
    ('Belizean','Belize'), ('Beninese','Benin'), ('Bhutanese','Bhutan'),
    ('Bolivian','Bolivia'), ('Bosnian','Bosnia and Herzegovina'),
    ('Botswanan','Botswana'), ('Brazilian','Brazil'), ('British','United Kingdom'),
    ('Bruneian','Brunei'), ('Bulgarian','Bulgaria'), ('Burkinabé','Burkina Faso'),
    ('Burkinabe','Burkina Faso'), ('Burmese','Myanmar'), ('Burundian','Burundi'),
    ('Cambodian','Cambodia'), ('Cameroonian','Cameroon'), ('Canadian','Canada'),
    ('Cape Verdean','Cape Verde'), ('Central African','Central African Republic'),
    ('Chadian','Chad'), ('Chilean','Chile'), ('Chinese','China'),
    ('Colombian','Colombia'), ('Comorian','Comoros'), ('Congolese','Congo'),
    ('Costa Rican','Costa Rica'), ('Croatian','Croatia'), ('Cuban','Cuba'),
    ('Cypriot','Cyprus'), ('Czech','Czech Republic'), ('Danish','Denmark'),
    ('Djiboutian','Djibouti'), ('Dominican','Dominican Republic'),
    ('Dutch','Netherlands'), ('Ecuadorian','Ecuador'), ('Egyptian','Egypt'),
    ('Emirati','United Arab Emirates'), ('English','United Kingdom'),
    ('Equatorial Guinean','Equatorial Guinea'), ('Eritrean','Eritrea'),
    ('Estonian','Estonia'), ('Ethiopian','Ethiopia'), ('Fijian','Fiji'),
    ('Filipino','Philippines'), ('Finnish','Finland'), ('French','France'),
    ('Gabonese','Gabon'), ('Gambian','Gambia'), ('Georgian','Georgia'),
    ('German','Germany'), ('Ghanaian','Ghana'), ('Greek','Greece'),
    ('Grenadian','Grenada'), ('Guatemalan','Guatemala'), ('Guinean','Guinea'),
    ('Guyanese','Guyana'), ('Haitian','Haiti'), ('Honduran','Honduras'),
    ('Hong Konger','Hong Kong'), ('Hungarian','Hungary'), ('Icelandic','Iceland'),
    ('Indian','India'), ('Indonesian','Indonesia'), ('Iranian','Iran'),
    ('Iraqi','Iraq'), ('Irish','Ireland'), ('Israeli','Israel'),
    ('Italian','Italy'), ('Ivorian','Ivory Coast'), ('Jamaican','Jamaica'),
    ('Japanese','Japan'), ('Jordanian','Jordan'), ('Kazakhstani','Kazakhstan'),
    ('Kazakh','Kazakhstan'), ('Kenyan','Kenya'), ('Kiribati','Kiribati'),
    ('Kosovar','Kosovo'), ('Kuwaiti','Kuwait'), ('Kyrgyz','Kyrgyzstan'),
    ('Lao','Laos'), ('Latvian','Latvia'), ('Lebanese','Lebanon'),
    ('Liberian','Liberia'), ('Libyan','Libya'),
    ('Liechtensteiner','Liechtenstein'), ('Lithuanian','Lithuania'),
    ('Luxembourgish','Luxembourg'), ('Macedonian','North Macedonia'),
    ('Malagasy','Madagascar'), ('Malawian','Malawi'), ('Malaysian','Malaysia'),
    ('Maldivian','Maldives'), ('Malian','Mali'), ('Maltese','Malta'),
    ('Marshallese','Marshall Islands'), ('Mauritanian','Mauritania'),
    ('Mauritian','Mauritius'), ('Mexican','Mexico'),
    ('Micronesian','Micronesia'), ('Moldovan','Moldova'), ('Monégasque','Monaco'),
    ('Monegasque','Monaco'), ('Mongolian','Mongolia'),
    ('Montenegrin','Montenegro'), ('Moroccan','Morocco'),
    ('Mozambican','Mozambique'), ('Namibian','Namibia'), ('Nauruan','Nauru'),
    ('Nepali','Nepal'), ('New Zealander','New Zealand'),
    ('Nicaraguan','Nicaragua'), ('Nigerian','Nigeria'), ('Nigerien','Niger'),
    ('North Korean','North Korea'), ('Northern Irish','United Kingdom'),
    ('Norwegian','Norway'), ('Omani','Oman'), ('Pakistani','Pakistan'),
    ('Palauan','Palau'), ('Palestinian','Palestine'), ('Panamanian','Panama'),
    ('Papua New Guinean','Papua New Guinea'), ('Paraguayan','Paraguay'),
    ('Peruvian','Peru'), ('Polish','Poland'), ('Portuguese','Portugal'),
    ('Qatari','Qatar'), ('Romanian','Romania'), ('Russian','Russia'),
    ('Rwandan','Rwanda'), ('Saint Lucian','Saint Lucia'),
    ('Salvadoran','El Salvador'), ('Sammarinese','San Marino'),
    ('Samoan','Samoa'), ('São Toméan','São Tomé and Príncipe'),
    ('Sao Tomean','São Tomé and Príncipe'), ('Saudi','Saudi Arabia'),
    ('Scottish','United Kingdom'), ('Senegalese','Senegal'),
    ('Serbian','Serbia'), ('Seychellois','Seychelles'),
    ('Sierra Leonean','Sierra Leone'), ('Singaporean','Singapore'),
    ('Slovak','Slovakia'), ('Slovenian','Slovenia'),
    ('Solomon Islander','Solomon Islands'), ('Somali','Somalia'),
    ('South African','South Africa'), ('South Korean','South Korea'),
    ('South Sudanese','South Sudan'), ('Spanish','Spain'),
    ('Sri Lankan','Sri Lanka'), ('Sudanese','Sudan'),
    ('Surinamese','Suriname'), ('Swazi','Eswatini'), ('Swedish','Sweden'),
    ('Swiss','Switzerland'), ('Syrian','Syria'), ('Taiwanese','Taiwan'),
    ('Tajik','Tajikistan'), ('Tanzanian','Tanzania'), ('Thai','Thailand'),
    ('Timorese','East Timor'), ('Togolese','Togo'), ('Tongan','Tonga'),
    ('Trinidadian','Trinidad and Tobago'), ('Tunisian','Tunisia'),
    ('Turkish','Turkey'), ('Turkmen','Turkmenistan'), ('Tuvaluan','Tuvalu'),
    ('Ugandan','Uganda'), ('Ukrainian','Ukraine'), ('Uruguayan','Uruguay'),
    ('Uzbek','Uzbekistan'), ('Vanuatuan','Vanuatu'),
    ('Vatican','Vatican City'), ('Venezuelan','Venezuela'),
    ('Vietnamese','Vietnam'), ('Welsh','United Kingdom'),
    ('Yemeni','Yemen'), ('Zambian','Zambia'), ('Zimbabwean','Zimbabwe')
)
update public.clients c
   set nationality = m.country
  from mapping m
 where lower(trim(c.nationality)) = lower(m.adjective);

commit;
