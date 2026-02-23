const express = require('express');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

function normalizeCountryParam(inputCode) {
  const raw = String(inputCode || '').trim();
  const upper = raw.toUpperCase();

  const aliases = {
    GHANA: 'GH',
    NIGERIA: 'NG',
    KENYA: 'KE',
    'SOUTH-AFRICA': 'ZA',
    SOUTHAFRICA: 'ZA',
    UGANDA: 'UG',
    TANZANIA: 'TZ',
    RWANDA: 'RW',
    BOTSWANA: 'BW',
    ZAMBIA: 'ZM',
    MALAWI: 'MW'
  };

  return aliases[upper] || upper;
}

/**
 * @route   GET /api/countries
 * @desc    Get all supported African countries
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const countryManager = req.countryManager;
    
    const countries = countryManager.getAllCountries();
    
    res.json({
      success: true,
      countries: countries.map(country => ({
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        timezone: country.timezone,
        phoneCode: country.phoneCode,
        paymentMethod: country.paymentMethod || 'crypto',
        localBanks: country.localBanks,
        mobileMoney: country.mobileMoney
      }))
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Comprehensive cities, towns, and regional centers for African countries (for autocomplete)
// Includes capitals, major cities, regional capitals, towns, and notable settlements
const AFRICAN_CITIES = {
  // NIGERIA - 36 States + FCT
  NG: [
    // Lagos State
    'Lagos', 'Ikeja', 'Victoria Island', 'Lekki', 'Ikoyi', 'Surulere', 'Yaba', 'Mushin', 'Oshodi', 'Apapa', 'Festac Town', 'Ajah', 'Badagry', 'Epe', 'Ikorodu', 'Agege', 'Alimosho', 'Ojodu', 'Magodo', 'Maryland', 'Anthony', 'Ogudu', 'Gbagada', 'Somolu', 'Bariga',
    // FCT Abuja
    'Abuja', 'Garki', 'Wuse', 'Maitama', 'Asokoro', 'Gwarinpa', 'Kubwa', 'Nyanya', 'Karu', 'Lugbe', 'Dutse', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali',
    // Other Major Cities & State Capitals
    'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna', 'Enugu', 'Onitsha', 'Calabar', 'Warri', 'Aba', 'Jos', 'Ilorin', 'Abeokuta', 'Oyo', 'Owerri', 'Uyo', 'Asaba', 'Akure', 'Maiduguri', 'Sokoto', 'Zaria', 'Lokoja', 'Makurdi', 'Ado-Ekiti', 'Osogbo', 'Bauchi', 'Yola', 'Lafia', 'Gombe', 'Jalingo', 'Minna', 'Birnin Kebbi', 'Dutse', 'Gusau', 'Katsina', 'Damaturu', 'Awka', 'Abakaliki', 'Umuahia', 'Eket', 'Nsukka', 'Nnewi', 'Sapele', 'Effurun', 'Ughelli', 'Agbor', 'Ogbomoso', 'Ife', 'Ilesha', 'Sagamu', 'Ondo', 'Ikare', 'Owo', 'Offa', 'Omu-Aran', 'Saki', 'Iseyin', 'Igboho', 'Auchi', 'Ekpoma', 'Uromi', 'Irrua', 'Igarra', 'Ikom', 'Ogoja', 'Obudu', 'Bonny', 'Okrika', 'Eleme', 'Bori', 'Degema'
  ],
  
  // GHANA - 16 Regions
  GH: [
    // Greater Accra Region
    'Accra', 'Tema', 'Madina', 'Teshie', 'Nungua', 'Adenta', 'Dome', 'Achimota', 'Kaneshie', 'Dansoman', 'Mamprobi', 'Osu', 'Labadi', 'La', 'Dodowa', 'Prampram', 'Ada Foah', 'Kasoa', 'Weija', 'Ablekuma', 'Ashaiman', 'Sakumono', 'Spintex', 'East Legon', 'Airport Residential', 'Dzorwulu', 'Roman Ridge', 'Cantonments',
    // Ashanti Region
    'Kumasi', 'Obuasi', 'Ejisu', 'Konongo', 'Mampong', 'Bekwai', 'Agogo', 'Juaben', 'Asokore Mampong', 'Tafo', 'Suame', 'Adum', 'Bantama', 'Ahinsan', 'Atonsu', 'Kwadaso', 'Nhyiaeso', 'Asawase', 'Offinso', 'Nkawie', 'Asante Akim',
    // Northern Region
    'Tamale', 'Yendi', 'Salaga', 'Damongo', 'Bimbilla', 'Saboba', 'Gushegu', 'Karaga', 'Savelugu', 'Walewale',
    // Western Region
    'Takoradi', 'Sekondi', 'Tarkwa', 'Prestea', 'Axim', 'Elubo', 'Bogoso', 'Bibiani', 'Sefwi Wiawso', 'Enchi', 'Half Assini', 'Shama',
    // Central Region
    'Cape Coast', 'Elmina', 'Winneba', 'Kasoa', 'Mankessim', 'Saltpond', 'Anomabo', 'Moree', 'Agona Swedru', 'Assin Fosu', 'Dunkwa-on-Offin',
    // Eastern Region
    'Koforidua', 'Nkawkaw', 'Akim Oda', 'Akosombo', 'Nsawam', 'Suhum', 'Aburi', 'Mampong', 'Somanya', 'Kpong', 'Asamankese', 'Kibi', 'Donkorkrom',
    // Volta Region
    'Ho', 'Hohoe', 'Aflao', 'Keta', 'Kpando', 'Denu', 'Anloga', 'Sogakope', 'Adidome', 'Akatsi', 'Peki',
    // Bono Region
    'Sunyani', 'Berekum', 'Dormaa Ahenkro', 'Wenchi', 'Techiman', 'Kintampo', 'Nkoranza', 'Atebubu', 'Yeji',
    // Upper East Region
    'Bolgatanga', 'Navrongo', 'Bawku', 'Zebilla', 'Paga', 'Tongo', 'Bongo',
    // Upper West Region
    'Wa', 'Tumu', 'Lawra', 'Nandom', 'Jirapa', 'Nadowli',
    // Other Towns
    'Akropong', 'Larteh', 'Abetifi', 'Mpraeso', 'Kwahu Tafo', 'Nkwatia'
  ],
  
  // KENYA - 47 Counties
  KE: [
    // Nairobi
    'Nairobi', 'Westlands', 'Karen', 'Langata', 'Kibera', 'Eastleigh', 'Parklands', 'Lavington', 'Kilimani', 'Kileleshwa', 'Hurlingham', 'South B', 'South C', 'Buruburu', 'Umoja', 'Kayole', 'Dandora', 'Kasarani', 'Roysambu', 'Ruaraka', 'Embakasi', 'Pipeline', 'Utawala', 'Donholm', 'Jogoo Road', 'Industrial Area', 'Githurai', 'Kahawa', 'Zimmerman',
    // Mombasa
    'Mombasa', 'Nyali', 'Bamburi', 'Shanzu', 'Likoni', 'Changamwe', 'Kisauni', 'Mvita', 'Port Reitz', 'Miritini',
    // Other Major Cities & Towns
    'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale', 'Garissa', 'Nyeri', 'Machakos', 'Meru', 'Lamu', 'Naivasha', 'Kakamega', 'Kericho', 'Nanyuki', 'Bungoma', 'Isiolo', 'Embu', 'Kiambu', 'Ruiru', 'Juja', 'Kikuyu', 'Limuru', 'Gatundu', 'Kilifi', 'Voi', 'Migori', 'Homa Bay', 'Kisii', 'Nyamira', 'Bomet', 'Narok', 'Kajiado', 'Kitui', 'Makueni', 'Wote', 'Mwingi', 'Tharaka', 'Chuka', 'Maua', 'Nkubu', 'Kerugoya', 'Karatina', 'Othaya', 'Muranga', 'Kangema', 'Maragua', 'Kenol', 'Sagana', 'Busia', 'Siaya', 'Ukunda', 'Diani', 'Watamu', 'Mtwapa', 'Mariakani', 'Wundanyi', 'Taveta', 'Lodwar', 'Marsabit', 'Moyale', 'Mandera', 'Wajir', 'Kapenguria', 'Maralal', 'Baringo', 'Kabarnet', 'Iten', 'Kapsabet', 'Nandi Hills', 'Webuye', 'Mumias', 'Malava', 'Butere', 'Luanda', 'Vihiga', 'Mbale', 'Soy', 'Moiben', 'Turbo', 'Burnt Forest', 'Timboroa', 'Molo', 'Elburgon', 'Njoro', 'Gilgil', 'Kinangop', 'Engineer', 'Naivasha'
  ],
  
  // SOUTH AFRICA - 9 Provinces
  ZA: [
    // Gauteng
    'Johannesburg', 'Pretoria', 'Sandton', 'Soweto', 'Centurion', 'Midrand', 'Randburg', 'Roodepoort', 'Germiston', 'Boksburg', 'Benoni', 'Springs', 'Alberton', 'Edenvale', 'Kempton Park', 'Tembisa', 'Krugersdorp', 'Randfontein', 'Carletonville', 'Vanderbijlpark', 'Vereeniging', 'Sebokeng', 'Bronkhorstspruit', 'Heidelberg', 'Nigel', 'Brakpan', 'Alexandra', 'Diepsloot', 'Fourways', 'Sunninghill', 'Bryanston', 'Hyde Park', 'Melrose', 'Rosebank', 'Parktown', 'Houghton', 'Bedfordview', 'Parkview', 'Northcliff', 'Linden', 'Emmarentia', 'Greenside',
    // Western Cape
    'Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Mossel Bay', 'Knysna', 'Plettenberg Bay', 'Hermanus', 'Worcester', 'Franschhoek', 'Camps Bay', 'Sea Point', 'Green Point', 'Waterfront', 'Woodstock', 'Observatory', 'Claremont', 'Rondebosch', 'Newlands', 'Constantia', 'Hout Bay', 'Fish Hoek', 'Simons Town', 'Muizenberg', 'Khayelitsha', 'Mitchell\'s Plain', 'Bellville', 'Durbanville', 'Tableview', 'Milnerton', 'Bloubergstrand', 'Century City', 'Tygervalley', 'Parow', 'Goodwood', 'Athlone', 'Gugulethu', 'Langa', 'Nyanga', 'Philippi',
    // KwaZulu-Natal
    'Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Ladysmith', 'Pinetown', 'Umhlanga', 'Ballito', 'Westville', 'Hillcrest', 'Kloof', 'Amanzimtoti', 'Scottburgh', 'Port Shepstone', 'Margate', 'Empangeni', 'Eshowe', 'Ulundi', 'Vryheid', 'Dundee', 'Howick', 'Estcourt', 'Greytown', 'Stanger', 'Tongaat', 'Verulam', 'Phoenix', 'Chatsworth', 'Umlazi', 'Kwa-Mashu',
    // Eastern Cape
    'Port Elizabeth', 'East London', 'Mthatha', 'Bhisho', 'Grahamstown', 'Uitenhage', 'Despatch', 'Queenstown', 'King Williams Town', 'Fort Beaufort', 'Cradock', 'Graaff-Reinet', 'Aliwal North', 'Butterworth', 'Komani', 'Jeffreys Bay', 'Colchester', 'Addo',
    // Free State
    'Bloemfontein', 'Welkom', 'Bethlehem', 'Kroonstad', 'Sasolburg', 'Parys', 'Phuthaditjhaba', 'Virginia', 'Ladybrand', 'Ficksburg', 'Harrismith', 'Bothaville', 'Zastron', 'Trompsburg',
    // Limpopo
    'Polokwane', 'Mokopane', 'Tzaneen', 'Phalaborwa', 'Louis Trichardt', 'Thohoyandou', 'Musina', 'Bela-Bela', 'Modimolle', 'Lephalale', 'Thabazimbi', 'Burgersfort', 'Lebowakgomo', 'Giyani', 'Modjadjiskloof',
    // Mpumalanga
    'Nelspruit', 'Witbank', 'Secunda', 'Middelburg', 'Standerton', 'Ermelo', 'Barberton', 'White River', 'Hazyview', 'Graskop', 'Sabie', 'Lydenburg', 'Piet Retief', 'Volksrust', 'Bethal', 'Komatipoort', 'Malelane',
    // North West
    'Rustenburg', 'Potchefstroom', 'Klerksdorp', 'Mahikeng', 'Brits', 'Orkney', 'Hartbeespoort', 'Lichtenburg', 'Vryburg', 'Zeerust', 'Wolmaransstad', 'Christiana', 'Stilfontein', 'Schweizer-Reneke',
    // Northern Cape
    'Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman', 'Colesberg', 'Kathu', 'Postmasburg', 'Carnarvon', 'Victoria West', 'Calvinia', 'Prieska', 'Douglas', 'Hanover'
  ],
  
  // UGANDA - 4 Regions, 135+ Districts
  UG: [
    // Central Region
    'Kampala', 'Entebbe', 'Wakiso', 'Mukono', 'Jinja', 'Masaka', 'Mityana', 'Mubende', 'Luweero', 'Nakasongola', 'Kayunga', 'Mpigi', 'Butambala', 'Gomba', 'Kalangala', 'Buikwe', 'Buvuma', 'Nakaseke', 'Kiboga', 'Kyankwanzi', 'Rakai', 'Lyantonde', 'Lwengo', 'Kalungu', 'Bukomansimbi', 'Sembabule', 'Kyotera', 'Ntenjeru', 'Namayingo',
    // Eastern Region  
    'Mbale', 'Tororo', 'Busia', 'Soroti', 'Kumi', 'Kapchorwa', 'Sironko', 'Bududa', 'Manafwa', 'Bulambuli', 'Pallisa', 'Kibuku', 'Budaka', 'Butaleja', 'Namutumba', 'Kaliro', 'Iganga', 'Bugiri', 'Mayuge', 'Kamuli', 'Buyende', 'Luuka', 'Amuria', 'Bukedea', 'Ngora', 'Serere', 'Katakwi', 'Kaberamaido', 'Dokolo', 'Amolatar', 'Napak', 'Nakapiripirit', 'Moroto', 'Amudat', 'Kotido', 'Abim', 'Kaabong',
    // Northern Region
    'Gulu', 'Lira', 'Arua', 'Kitgum', 'Pader', 'Lamwo', 'Agago', 'Amuru', 'Nwoya', 'Omoro', 'Oyam', 'Kole', 'Alebtong', 'Otuke', 'Apac', 'Kwania', 'Nebbi', 'Pakwach', 'Zombo', 'Moyo', 'Adjumani', 'Obongi', 'Yumbe', 'Koboko', 'Maracha', 'Terego',
    // Western Region
    'Mbarara', 'Fort Portal', 'Kasese', 'Kabale', 'Hoima', 'Masindi', 'Bushenyi', 'Rukungiri', 'Kanungu', 'Kisoro', 'Ntungamo', 'Isingiro', 'Ibanda', 'Kiruhura', 'Lyantonde', 'Rakai', 'Ssembabule', 'Kamwenge', 'Kyenjojo', 'Bundibugyo', 'Ntoroko', 'Buliisa', 'Kibaale', 'Kakumiro', 'Kagadi', 'Kiryandongo', 'Rubirizi', 'Sheema', 'Mitooma', 'Buhweju', 'Rubanda'
  ],
  
  // TANZANIA - 31 Regions
  TZ: [
    // Dar es Salaam Region
    'Dar es Salaam', 'Kinondoni', 'Ilala', 'Temeke', 'Ubungo', 'Kigamboni', 'Kariakoo', 'Mikocheni', 'Masaki', 'Oyster Bay', 'Msasani', 'Kawe', 'Mbezi', 'Tegeta', 'Kibaha',
    // Other Major Cities & Regional Capitals
    'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Zanzibar City', 'Moshi', 'Tabora', 'Kigoma', 'Iringa', 'Mtwara', 'Songea', 'Musoma', 'Shinyanga', 'Singida', 'Sumbawanga', 'Bukoba', 'Lindi', 'Mpanda', 'Babati', 'Njombe', 'Geita', 'Katavi', 'Rukwa', 'Kagera',
    // Notable Towns
    'Bagamoyo', 'Kilwa', 'Mikumi', 'Korogwe', 'Same', 'Mwanga', 'Lushoto', 'Handeni', 'Pangani', 'Muheza', 'Mkuranga', 'Kisarawe', 'Mafia Island', 'Kilwa Masoko', 'Nachingwea', 'Masasi', 'Newala', 'Tandahimba', 'Mbinga', 'Tunduru', 'Namtumbo', 'Ludewa', 'Makete', 'Wanging\'ombe', 'Kyela', 'Tukuyu', 'Rungwe', 'Mbarali', 'Chunya', 'Nkasi', 'Kalambo', 'Kasulu', 'Kibondo', 'Kakonko', 'Uvinza', 'Sengerema', 'Misungwi', 'Kwimba', 'Magu', 'Ukerewe', 'Ilemela', 'Nyamagana', 'Bunda', 'Serengeti', 'Tarime', 'Rorya', 'Butiama', 'Kahama', 'Shinyanga Urban', 'Kishapu', 'Meatu', 'Bariadi', 'Itilima', 'Maswa', 'Nzega', 'Igunga', 'Uyui', 'Urambo', 'Sikonge', 'Kaliua', 'Karatu', 'Monduli', 'Longido', 'Ngorongoro', 'Arumeru', 'Meru', 'Hai', 'Siha', 'Rombo', 'Kilimanjaro', 'Kondoa', 'Chemba', 'Chamwino', 'Bahi', 'Kongwa', 'Mpwapwa', 'Kilosa', 'Mvomero', 'Gairo', 'Kilombero', 'Ulanga', 'Malinyi', 'Ifakara'
  ],
  
  // RWANDA - 5 Provinces, 30 Districts
  RW: [
    // Kigali Province
    'Kigali', 'Nyarugenge', 'Gasabo', 'Kicukiro', 'Kimihurura', 'Kacyiru', 'Gisozi', 'Remera', 'Nyamirambo', 'Kimironko', 'Gikondo', 'Kanombe',
    // Eastern Province
    'Rwamagana', 'Kayonza', 'Ngoma', 'Kirehe', 'Bugesera', 'Nyagatare', 'Gatsibo',
    // Southern Province
    'Huye', 'Nyanza', 'Gisagara', 'Nyaruguru', 'Ruhango', 'Muhanga', 'Kamonyi', 'Nyamagabe',
    // Western Province
    'Rubavu', 'Rusizi', 'Nyamasheke', 'Karongi', 'Rutsiro', 'Ngororero',
    // Northern Province
    'Musanze', 'Burera', 'Gicumbi', 'Rulindo', 'Gakenke',
    // Historic/Other Towns
    'Butare', 'Gitarama', 'Ruhengeri', 'Gisenyi', 'Cyangugu', 'Kibuye', 'Byumba', 'Kabuga', 'Muhima', 'Biryogo', 'Gitega', 'Nyabugogo', 'Kimisagara', 'Rwezamenyo', 'Kabutare', 'Tumba', 'Ngenda', 'Rilima', 'Musha', 'Sake', 'Ndera', 'Masaka', 'Runda', 'Jabana', 'Kinigi', 'Cyanika', 'Busogo', 'Shyira', 'Bigogwe', 'Mukamira', 'Karago', 'Rugerero', 'Nyundo', 'Mahoko', 'Gihundwe', 'Kamembe', 'Nyakabuye', 'Kirambo', 'Nkanka', 'Ruharambuga', 'Butaro', 'Kinihira', 'Cyuve', 'Rwaza', 'Nkuli', 'Nyabihu'
  ],
  
  // BOTSWANA - 10 Districts
  BW: [
    // South-East District (Capital)
    'Gaborone', 'Tlokweng', 'Mogoditshane', 'Ramotswa', 'Lobatse', 'Otse', 'Mochudi', 'Pilane', 'Oodi', 'Bokaa', 'Morwa', 'Mmathubudukwane', 'Sikwane', 'Kopong', 'Gabane', 'Mmopane', 'Metsimotlhabe',
    // Central District
    'Serowe', 'Palapye', 'Mahalapye', 'Selibe Phikwe', 'Bobonong', 'Maunatlala', 'Tonota', 'Shashe Mooke', 'Tutume', 'Nata', 'Gweta', 'Letlhakane', 'Orapa', 'Rakops', 'Mopipi', 'Lerala', 'Mmadinare', 'Machaneng', 'Shoshong',
    // North-East District
    'Francistown', 'Tati Siding', 'Matsiloje', 'Ramokgwebana', 'Masunga', 'Zwenshambe', 'Mapoka', 'Jackalas No.1', 'Jackalas No.2',
    // North-West District
    'Maun', 'Kasane', 'Kazungula', 'Shakawe', 'Gumare', 'Nokaneng', 'Sehithwa', 'Etsha', 'Shorobe', 'Nata', 'Pandamatenga',
    // Kgalagadi District
    'Tsabong', 'Werda', 'Bokspits', 'Omaweneno', 'Middlepits', 'Khakhea', 'Makopong', 'Khuis', 'Lokgwabe', 'Lehututu', 'Kang', 'Hukuntsi', 'Ncojane', 'Tshane', 'Hunhukwe',
    // Ghanzi District
    'Ghanzi', 'Dkar', 'Charles Hill', 'West Hanahai', 'Kuke', 'Bere', 'Karakubis', 'Grootlaagte', 'Kacgae', 'Xade', 'New Xade',
    // Southern District
    'Kanye', 'Moshupa', 'Thamaga', 'Jwaneng', 'Molapowabojang', 'Ranaka', 'Sejelo', 'Ntlhantlhe', 'Sese', 'Magotlhwane', 'Manyana', 'Mmathethe', 'Sesung', 'Gasita',
    // Kweneng District
    'Molepolole', 'Letlhakeng', 'Thamaga', 'Lentsweletau', 'Gakuto', 'Dutlwe', 'Takatokwane', 'Salajwe', 'Sojwe', 'Khudumelapye', 'Sorilatholo', 'Ditshegwane', 'Kubung', 'Metsibotlhoko', 'Shadishadi'
  ],
  
  // ZAMBIA - 10 Provinces
  ZM: [
    // Lusaka Province
    'Lusaka', 'Chongwe', 'Kafue', 'Chirundu', 'Siavonga', 'Chilanga', 'Chainda', 'Chalimbana', 'Chipata', 'Kabulonga', 'Woodlands', 'Roma', 'Olympia Park', 'Northmead', 'Avondale', 'Kabwata', 'Chilenje', 'Emmasdale', 'Garden', 'Makeni', 'Ibex Hill', 'Sunningdale',
    // Copperbelt Province
    'Kitwe', 'Ndola', 'Chingola', 'Mufulira', 'Luanshya', 'Chililabombwe', 'Kalulushi', 'Chambishi', 'Garneton', 'Masaiti', 'Mpongwe', 'Lufwanyama', 'Fisenge', 'Kawama', 'Wusakile', 'Nkana',
    // Central Province
    'Kabwe', 'Kapiri Mposhi', 'Serenje', 'Mkushi', 'Chibombo', 'Mumbwa', 'Itezhi-Tezhi', 'Ngabwe', 'Chisamba', 'Luano', 'Shibuyunji',
    // Southern Province
    'Livingstone', 'Choma', 'Mazabuka', 'Monze', 'Kalomo', 'Namwala', 'Sinazongwe', 'Kazungula', 'Zimba', 'Gwembe', 'Siavonga', 'Pemba', 'Batoka', 'Maamba', 'Victoria Falls Town',
    // Eastern Province
    'Chipata', 'Petauke', 'Katete', 'Lundazi', 'Nyimba', 'Sinda', 'Chadiza', 'Vubwi', 'Mambwe', 'Chama', 'Lumezi', 'Kasenengwa',
    // Northern Province
    'Kasama', 'Mbala', 'Mpulungu', 'Mporokoso', 'Luwingu', 'Mungwi', 'Chinsali', 'Isoka', 'Nakonde', 'Kaputa', 'Nsama', 'Lupososhi', 'Chilubi', 'Senga Hill', 'Kanchibiya',
    // Luapula Province
    'Mansa', 'Samfya', 'Kawambwa', 'Nchelenge', 'Mwense', 'Chembe', 'Chipili', 'Lunga', 'Milenge', 'Mwansabombwe',
    // North-Western Province
    'Solwezi', 'Mwinilunga', 'Kasempa', 'Zambezi', 'Chavuma', 'Kabompo', 'Kalumbila', 'Mushindamo', 'Manyinga', 'Ikelenge',
    // Western Province
    'Mongu', 'Senanga', 'Kaoma', 'Sesheke', 'Kalabo', 'Shangombo', 'Sikongo', 'Sioma', 'Mulobezi', 'Limulunga', 'Nalolo', 'Lukulu', 'Mitete', 'Nkeyema', 'Mwandi',
    // Muchinga Province
    'Chinsali', 'Mpika', 'Nakonde', 'Chama', 'Isoka', 'Mafinga', 'Shiwang\'andu', 'Lavushimanda', 'Kanchibiya'
  ],
  
  // MALAWI - 3 Regions, 28 Districts
  MW: [
    // Southern Region
    'Blantyre', 'Limbe', 'Zomba', 'Thyolo', 'Mulanje', 'Chiradzulu', 'Phalombe', 'Chikwawa', 'Nsanje', 'Mwanza', 'Neno', 'Mangochi', 'Machinga', 'Balaka', 'Liwonde', 'Luchenza', 'Bangula', 'Ngabu', 'Nchalo', 'Sukwa', 'Ntcheu', 'Bvumbwe', 'Chigumula', 'Ndirande', 'Chilomoni', 'Bangwe', 'Zingwangwa', 'Soche', 'Chirimba',
    // Central Region
    'Lilongwe', 'Dedza', 'Dowa', 'Kasungu', 'Mchinji', 'Nkhotakota', 'Ntchisi', 'Salima', 'Mponela', 'Chimbiya', 'Namitete', 'Mitundu', 'Dzalanyama', 'Nathenje', 'Malingunde', 'Kamuzu International Airport Area', 'Area 18', 'Area 25', 'Area 47', 'Area 49', 'Old Town', 'City Centre',
    // Northern Region
    'Mzuzu', 'Karonga', 'Chitipa', 'Rumphi', 'Nkhata Bay', 'Likoma', 'Mzimba', 'Ekwendeni', 'Edingeni', 'Embangweni', 'Emsizini', 'Euthini', 'Hewe', 'Hora', 'Jenda', 'Khondowe', 'Livingstonia', 'Loudon', 'Lunyangwa', 'Mtwalo', 'Njakwa', 'Phwezi', 'Usisya', 'Chintheche', 'Nkhata Bay', 'Dwangwa', 'Kande', 'Bandawe', 'Chilumba', 'Mlowe', 'Chitimba', 'Iponga', 'Kaporo', 'Lupembe', 'Malema', 'Mbamba Bay', 'Muyombe', 'Chisenga', 'Livingstonia', 'Mhuju'
  ]
};

// Also add regions/states for each country for the Region/State field
const AFRICAN_REGIONS = {
  NG: ['Lagos', 'Abuja FCT', 'Kano', 'Oyo', 'Rivers', 'Kaduna', 'Katsina', 'Ogun', 'Anambra', 'Borno', 'Delta', 'Imo', 'Akwa Ibom', 'Osun', 'Enugu', 'Edo', 'Benue', 'Plateau', 'Ondo', 'Bauchi', 'Kwara', 'Cross River', 'Abia', 'Ekiti', 'Niger', 'Sokoto', 'Kogi', 'Adamawa', 'Jigawa', 'Kebbi', 'Zamfara', 'Taraba', 'Bayelsa', 'Ebonyi', 'Gombe', 'Nasarawa', 'Yobe'],
  GH: ['Greater Accra', 'Ashanti', 'Northern', 'Western', 'Central', 'Eastern', 'Volta', 'Bono', 'Bono East', 'Ahafo', 'Upper East', 'Upper West', 'North East', 'Savannah', 'Oti', 'Western North'],
  KE: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Uasin Gishu', 'Kilifi', 'Machakos', 'Kajiado', 'Nyeri', 'Meru', 'Kakamega', 'Bungoma', 'Kisii', 'Trans Nzoia', 'Laikipia', 'Embu', 'Muranga', 'Nyandarua', 'Kericho', 'Bomet', 'Narok', 'Migori', 'Homa Bay', 'Siaya', 'Busia', 'Vihiga', 'Nyamira', 'Kitui', 'Makueni', 'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Tharaka Nithi', 'Kirinyaga', 'Nandi', 'Baringo', 'Elgeyo Marakwet', 'West Pokot', 'Samburu', 'Turkana', 'Kwale', 'Taita Taveta', 'Lamu', 'Tana River'],
  ZA: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'],
  UG: ['Central Region', 'Eastern Region', 'Northern Region', 'Western Region'],
  TZ: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Kagera', 'Geita', 'Shinyanga', 'Tabora', 'Kigoma', 'Mara', 'Kilimanjaro', 'Singida', 'Iringa', 'Njombe', 'Ruvuma', 'Mtwara', 'Lindi', 'Pwani', 'Zanzibar North', 'Zanzibar South', 'Zanzibar Urban/West', 'Pemba North', 'Pemba South', 'Rukwa', 'Katavi', 'Simiyu', 'Songwe', 'Manyara'],
  RW: ['Kigali', 'Eastern Province', 'Southern Province', 'Western Province', 'Northern Province'],
  BW: ['South-East', 'Central', 'North-East', 'North-West', 'Kgalagadi', 'Ghanzi', 'Southern', 'Kweneng', 'Kgatleng', 'Chobe'],
  ZM: ['Lusaka', 'Copperbelt', 'Central', 'Southern', 'Eastern', 'Northern', 'Luapula', 'North-Western', 'Western', 'Muchinga'],
  MW: ['Southern Region', 'Central Region', 'Northern Region']
};

/**
 * @route   GET /api/countries/:code/cities
 * @desc    Get cities for a specific country (for autocomplete)
 * @access  Public
 */
router.get('/:code/cities', async (req, res) => {
  try {
    const { code } = req.params;
    const { search = '' } = req.query;
    
    const countryCode = code.toUpperCase();
    const cities = AFRICAN_CITIES[countryCode] || [];
    
    // Filter cities by search term if provided
    let filteredCities = cities;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCities = cities.filter(city => 
        city.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      countryCode: countryCode,
      cities: filteredCities.slice(0, 100) // Return up to 100 cities for comprehensive coverage
    });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

/**
 * @route   GET /api/countries/:code/regions
 * @desc    Get regions/states for a specific country (for autocomplete)
 * @access  Public
 */
router.get('/:code/regions', async (req, res) => {
  try {
    const { code } = req.params;
    const { search = '' } = req.query;
    
    const countryCode = code.toUpperCase();
    const regions = AFRICAN_REGIONS[countryCode] || [];
    
    // Filter regions by search term if provided
    let filteredRegions = regions;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredRegions = regions.filter(region => 
        region.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      countryCode: countryCode,
      regions: filteredRegions
    });
  } catch (error) {
    console.error('Get regions error:', error);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

/**
 * @route   GET /api/countries/:code
 * @desc    Get specific country details
 * @access  Public
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const countryManager = req.countryManager;
    
    const country = countryManager.getCountryByCode(code);
    
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    res.json({
      success: true,
      country: {
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        timezone: country.timezone,
        phoneCode: country.phoneCode,
        paymentMethod: country.paymentMethod || 'crypto',
        localBanks: country.localBanks,
        mobileMoney: country.mobileMoney
      }
    });
  } catch (error) {
    console.error('Get country error:', error);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

/**
 * @route   POST /api/countries/detect
 * @desc    Detect user's country - uses phone number for registered users, IP for visitors
 * @access  Private (for registered users) or Public (for visitors)
 */
router.post('/detect', async (req, res) => {
  try {
    const { User, isDatabaseAvailable } = require('../config/database');
    const countryManager = req.countryManager;
    
    // Check if user is authenticated (registered user)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    let userId = null;
    let userPhone = null;
    
    if (token && isDatabaseAvailable()) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        userId = decoded.userId;
        
        // Get user's phone number from database
        // Special case for mock user
        if (userId === '00000000-0000-0000-0000-000000000001') {
          userPhone = '+233241234567'; // Mock user is Ghanaian
          console.log('🌍 Using mock user phone number:', userPhone);
        } else {
          const user = await User.findById(userId).select('phone profile_data');
          if (user) {
            userPhone = user.phone || user.profile_data?.phone;
          }
        }
      } catch (jwtError) {
        // Token invalid or expired - treat as visitor
        console.log('🌍 Invalid token, treating as visitor');
      }
    } else if (token && !isDatabaseAvailable()) {
      console.log('⚠️ Database unavailable, skipping user phone lookup for country detection');
    }
    
    // METHOD 0: For REGISTERED USERS - Check stored profile country (most reliable, set at registration)
    if (userId && isDatabaseAvailable()) {
      try {
        const user = await User.findById(userId).select('profile_data phone');
        if (user) {
          // Prefer countryCode (2-letter code), then location.countryCode
          const storedCode = user.profile_data?.countryCode 
            || user.profile_data?.location?.countryCode
            || user.profile_data?.detectedCountry;
          
          if (storedCode) {
            const storedCountry = countryManager.getCountryByCode(storedCode);
            if (storedCountry) {
              console.log(`🌍 Country from user profile: ${storedCountry.name} (${storedCode})`);
              return res.json({
                success: true,
                detectedCountry: storedCountry,
                method: 'user_profile',
                confidence: 'high',
                message: `Country from profile: ${storedCountry.name}`
              });
            }
          }
          
          // Also resolve from country name if code not found
          if (!storedCode && user.profile_data?.country) {
            const resolvedCountry = countryManager.supportedCountries?.find(
              c => c.name?.toLowerCase() === user.profile_data.country.toLowerCase()
            );
            if (resolvedCountry) {
              console.log(`🌍 Country resolved from profile name: ${resolvedCountry.name}`);
              // Save the code for future fast lookups
              await User.findByIdAndUpdate(userId, {
                'profile_data.countryCode': resolvedCountry.code
              }).catch(() => {});
              return res.json({
                success: true,
                detectedCountry: resolvedCountry,
                method: 'user_profile_name',
                confidence: 'high',
                message: `Country from profile: ${resolvedCountry.name}`
              });
            }
          }
          
          // Override userPhone from fresh DB read if not already set
          if (!userPhone) {
            userPhone = user.phone || user.profile_data?.phone;
          }
        }
      } catch (profileErr) {
        console.log('⚠️ Profile country lookup failed:', profileErr.message);
      }
    }
    
    // METHOD 1: For REGISTERED USERS - Use phone number country code
    if (userId && userPhone) {
      console.log(`🌍 Detecting country for registered user from phone: ${userPhone}`);
      const phoneDetection = countryManager.detectCountryFromPhone(userPhone);
      
      if (phoneDetection && phoneDetection.success) {
        // Store detected country for user
        if (isDatabaseAvailable()) {
          try {
            await countryManager.setDetectedCountry(userId, phoneDetection.country.code);
          } catch (e) {
            console.log('Could not store detected country:', e.message);
          }
        }
        
        return res.json({
          success: true,
          detectedCountry: phoneDetection.country,
          method: phoneDetection.method,
          confidence: phoneDetection.confidence,
          message: `Country detected from phone number: ${phoneDetection.country.name}`
        });
      }
    }
    
    // METHOD 2: For VISITORS/GUESTS - Use IP-based geolocation
    // Check if frontend already detected location (dev mode with real IP)
    const detectedLocation = req.body.detectedLocation;
    if (detectedLocation && detectedLocation.country && detectedLocation.countryCode) {
      console.log(`✅ Using frontend-detected location: ${detectedLocation.city}, ${detectedLocation.country}`);
      const country = countryManager.getCountryByCode(detectedLocation.countryCode);
      if (country) {
        // Store detected country for user if authenticated
        if (userId && isDatabaseAvailable()) {
          try {
            await countryManager.setDetectedCountry(userId, detectedLocation.countryCode);
          } catch (e) {
            console.log('Could not store detected country:', e.message);
          }
        }
        
        return res.json({
          success: true,
          detectedCountry: {
            ...country,
            lat: detectedLocation.lat,
            lng: detectedLocation.lng,
            city: detectedLocation.city
          },
          method: 'frontend_ip_detection',
          confidence: 'high',
          message: `Country detected: ${country.name}`
        });
      }
    }
    
    let ipAddress = req.body.ipAddress;
    if (!ipAddress) {
      ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                  req.headers['x-real-ip'] ||
                  req.connection?.remoteAddress ||
                  req.socket?.remoteAddress ||
                  req.ip ||
                  '127.0.0.1';
      
      // Handle IPv6 localhost
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
      }
    }
    
    console.log(`🌍 Detecting country for visitor from IP: ${ipAddress}`);
    
    // Try LocationTrackingService first (has better IP geolocation)
    let locationDetected = false;
    if (req.locationTrackingService) {
      try {
        const location = await req.locationTrackingService.processIPLocation(ipAddress);
        if (location && location.country && location.countryCode) {
          const detectedCountry = countryManager.getCountryByCode(location.countryCode);
          if (detectedCountry) {
            // Store detected country for user if authenticated
            if (userId && isDatabaseAvailable()) {
              try {
                await countryManager.setDetectedCountry(userId, location.countryCode);
              } catch (e) {
                console.log('Could not store detected country:', e.message);
              }
            }
            
            return res.json({
              success: true,
              detectedCountry: {
                ...detectedCountry,
                lat: location.lat,
                lng: location.lng,
                city: location.city
              },
              method: `ip_geolocation`,
              confidence: location.confidence || 'medium',
              message: `Country detected from IP: ${detectedCountry.name}`
            });
          }
        }
      } catch (e) {
        console.log('⚠️ LocationTrackingService IP detection failed, falling back to CountryManager');
      }
    }
    
    // Fallback to CountryManager
    const detectionResult = await countryManager.detectUserCountry(ipAddress);
    
    if (detectionResult.success) {
      // Store detected country for user if authenticated
      if (userId && isDatabaseAvailable()) {
        try {
          await countryManager.setDetectedCountry(userId, detectionResult.country.code);
        } catch (e) {
          console.log('Could not store detected country:', e.message);
        }
      }
      
      return res.json({
        success: true,
        detectedCountry: detectionResult.country,
        method: detectionResult.method,
        confidence: detectionResult.confidence,
        message: `Country detected: ${detectionResult.country.name}`
      });
    } else {
      // IP detection failed (localhost) - return default with notice
      const defaultCountry = countryManager.getCountryByCode('NG');
      return res.json({
        success: true,
        detectedCountry: defaultCountry,
        method: 'default_fallback',
        confidence: 'low',
        message: 'Could not detect country (local network). Using default: Nigeria. Please set your country preference.',
        requiresManualSelection: true
      });
    }
  } catch (error) {
    console.error('Country detection error:', error);
    res.status(500).json({ error: 'Failed to detect country' });
  }
});

/**
 * @route   GET /api/countries/user/preference
 * @desc    Get user's country preference
 * @access  Private
 */
router.get('/user/preference', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const countryManager = req.countryManager;
    
    const userCountry = await countryManager.getUserCountry(userId);
    
    if (userCountry.success) {
      res.json({
        success: true,
        preference: userCountry.country,
        detected: userCountry.detectedCountry,
        availableCountries: countryManager.getAllCountries()
      });
    } else {
      res.status(404).json({ error: userCountry.error });
    }
  } catch (error) {
    console.error('Get user country error:', error);
    res.status(500).json({ error: 'Failed to fetch user country' });
  }
});

/**
 * @route   PUT /api/countries/user/preference
 * @desc    Update user's country preference
 * @access  Private
 */
router.put('/user/preference', authMiddleware, [
  body('countryCode').isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { countryCode } = req.body;
    const userId = req.user.userId;
    
    const countryManager = req.countryManager;
    
    const updateResult = await countryManager.updateUserCountry(userId, countryCode);
    
    if (updateResult.success) {
      res.json({
        success: true,
        message: updateResult.message,
        country: updateResult.country
      });
    } else {
      res.status(400).json({ error: updateResult.error });
    }
  } catch (error) {
    console.error('Update user country error:', error);
    res.status(500).json({ error: 'Failed to update user country' });
  }
});

/**
 * @route   GET /api/countries/:code/payment-methods
 * @desc    Get country-specific payment methods
 * @access  Public
 */
router.get('/:code/payment-methods', async (req, res) => {
  try {
    const normalizedCode = normalizeCountryParam(req.params.code);
    const countryManager = req.countryManager;
    
    const paymentMethods = countryManager.getCountryPaymentMethods(normalizedCode);
    
    res.json({
      success: true,
      countryCode: normalizedCode,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('Get country payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * @route   GET /api/countries/:code/crypto-platforms
 * @desc    Get country-specific crypto platforms
 * @access  Public
 */
router.get('/:code/crypto-platforms', async (req, res) => {
  try {
    const normalizedCode = normalizeCountryParam(req.params.code);
    const countryManager = req.countryManager;
    
    const cryptoPlatforms = countryManager.getCryptoPlatforms(normalizedCode);
    
    res.json({
      success: true,
      countryCode: normalizedCode,
      cryptoPlatforms: cryptoPlatforms
    });
  } catch (error) {
    console.error('Get country crypto platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto platforms' });
  }
});

/**
 * @route   GET /api/countries/ghana/crypto-platforms
 * @desc    Get Ghanaian-specific crypto platforms
 * @access  Public
 */
router.get('/ghana/crypto-platforms', async (req, res) => {
  try {
    const countryManager = req.countryManager;
    
    const paymentOptions = countryManager.getPaymentOptions('GH');
    
    res.json({
      success: true,
      country: 'Ghana',
      flag: '🇬🇭',
      currency: 'GHS',
      paymentMethod: 'crypto',
      supportedCryptos: paymentOptions.supportedCryptos,
      specialFeatures: {
        mobileMoney: 'MTN, Vodafone, AirtelTigo support',
        localBanks: 'All major Ghanaian banks supported',
        cryptoPayments: 'Fee-free direct blockchain payments'
      }
    });
  } catch (error) {
    console.error('Get Ghanaian crypto platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch Ghanaian crypto platforms' });
  }
});

/**
 * @route   GET /api/countries/features/:feature
 * @desc    Get countries by specific feature
 * @access  Public
 */
router.get('/features/:feature', async (req, res) => {
  try {
    const { feature } = req.params;
    const countryManager = req.countryManager;
    
    const countries = countryManager.getCountriesByFeature(feature);
    
    res.json({
      success: true,
      feature: feature,
      countries: countries.map(country => ({
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol
      }))
    });
  } catch (error) {
    console.error('Get countries by feature error:', error);
    res.status(500).json({ error: 'Failed to fetch countries by feature' });
  }
});

module.exports = router;
