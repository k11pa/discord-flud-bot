// ==UserScript==
// @name         Помощник хелпера ROB RUN
// @namespace    https://github.com/k11pa/discord-flud-bot
// @version      1.0.0
// @description  Подсвечивает вопросы игроков в Discord и готовит ответ со ссылкой на robrun.info. Только читает страницу, ничего не отправляет.
// @match        https://discord.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ======================= НАСТРОЙКИ =======================
  const SITE = 'https://robrun.info';
  const MAX_AGE_MIN = 120;        // не показывать сообщения старше (минут)
  const SAME_USER_HOURS = 12;     // не предлагать одного игрока чаще, чем раз в N часов
  const MAX_LINKS = 3;            // максимум ссылок в ответе

  // Признаки вопроса: без них карточка не появится (защита от «я зарейдил базу, лол»)
  const QUESTION = ['?', 'как ', 'как?', 'где ', 'почему', 'зачем', 'что делать', 'что делает', 'что такое',
    'помогите', 'помоги', 'подскажите', 'подскажи', 'объясните', 'объясни', 'не могу', 'не получается',
    'не работает', 'сколько', 'можно ли', 'кто знает', 'гайд', 'не понимаю', 'не понял', 'help'];

  // Явная просьба о помощи — если тема не нашлась, даём ссылку на главную
  const HELP = ['помогите', 'подскажите', 'подскажи', 'помоги', 'кто знает', 'не понимаю', 'гайд', 'help', 'объясните'];

  // Темы: слова (корни, ищутся как начало слова), ссылки. Порядок = приоритет.
  const TOPICS = [
    { name: 'Новичок / с чего начать', words: ['с чего начать', 'новичок', 'новенький', 'только начал', 'только зашел', 'первый раз', 'впервые', 'ничего нет', 'первые шаги', 'как вообще играть', 'как начать играть', 'мини гайд', 'гайд для старта', 'гайд старта', 'гайд для новичк', 'старт'], links: [['С чего начать', '/faq/#s-chego-nachat'], ['Всё по игре', '/']] },
    { name: 'Рейд чужой базы', words: ['рейд', 'зарейд', 'рейдит', 'взлом баз', 'взломать дом', 'взломать баз', 'декодер', 'raid', 'decoder'], links: [['Гайд: взлом и защита базы', '/guides/raid/'], ['Как защитить базу', '/guides/building-plan/#как-защитить-базу']] },
    { name: 'Защита базы', words: ['защит', 'предохранител', 'сигнализац', 'систем охран', 'охран'], links: [['Как защитить базу', '/guides/building-plan/#как-защитить-базу'], ['Гайд: взлом и защита базы', '/guides/raid/']] },
    { name: 'Калькулятор поставок Ларри', words: ['сколько нужно денег', 'сколько денег', 'накопить', 'прокачк', 'прокачат', 'поставк', 'сколько стоит открыть', 'планнер', 'калькулятор'], links: [['Планнер поставок Ларри', '/planner/'], ['Дерево Ларри', '/mechanics/vendor-tree/']] },
    { name: 'Дерево Ларри', words: ['ларри', 'открыть товар', 'дерево'], links: [['Дерево Ларри', '/mechanics/vendor-tree/'], ['Планнер поставок', '/planner/']] },
    { name: 'Играть с другом', words: ['с друг', 'пати', 'вместе', 'сменить сервер', 'другой сервер', 'один сервер', 'сервер'], links: [['Как играть с другом', '/faq/#smena-servera'], ['Пригласить в группу', '/faq/#priglasit-v-gruppu']] },
    { name: 'Пригласить в группу', words: ['пригласит', 'инвайт', 'в группу', 'групп'], links: [['Пригласить в группу', '/faq/#priglasit-v-gruppu']] },
    { name: 'Роли', words: ['роль', 'роли', 'гражданск', 'преступник', 'маск'], links: [['Роли персонажа', '/faq/#roli']] },
    { name: 'Потеря вещей', words: ['теряю', 'потерял вещ', 'при смерти', 'умер', 'пропали вещ'], links: [['Что теряется при смерти и аресте', '/faq/#chto-teryaetsya']] },
    { name: 'Смена ника', words: ['ник', 'сменить имя'], links: [['Как сменить ник', '/faq/#smena-nika']] },
    { name: 'Вайпы', words: ['вайп'], links: [['Как часто вайпы', '/faq/#vajpy']] },
    { name: 'Участок', words: ['участок', 'участк', 'документ', 'поселени', 'купить дом'], links: [['Первый участок', '/faq/#pervyj-uchastok'], ['База и участок', '/mechanics/base/']] },
    { name: 'Доступ в дом', words: ['доступ в дом', 'пустить друг', 'доступ'], links: [['Доступ в дом другу или клану', '/faq/#dostup-v-dom']] },
    { name: 'Переезд', words: ['переехат', 'переезд'], links: [['Переезд', '/faq/#pereezd']] },
    { name: 'Налоги', words: ['налог'], links: [['Налоги с поселения', '/faq/#nalogi']] },
    { name: 'Выселение', words: ['выселит', 'выселени'], links: [['Выселение', '/faq/#vyselenie']] },
    { name: 'Мебель и строительство', words: ['мебел', 'поставить', 'строит', 'план строения', 'постройк'], links: [['План строения', '/guides/building-plan/']] },
    { name: 'Отмывка денег', words: ['отмыв', 'счет', 'грязн'], links: [['Отмывка денег', '/faq/#otmyvka'], ['Деньги и отмывка', '/mechanics/money/']] },
    { name: 'Продажа добычи', words: ['продат', 'скупщик', 'кому продавать', 'добыч'], links: [['Кому продавать добычу', '/faq/#komu-prodavat']] },
    { name: 'Полиция', words: ['стать коп', 'полицейск', 'служба в полиц', 'копом'], links: [['Как стать полицейским', '/faq/#stat-kopom']] },
    { name: 'Тюрьма', words: ['тюрьм', 'срок', 'наколк', 'розыск', 'арест', 'копы сильн'], links: [['Полиция и тюрьма', '/mechanics/police/'], ['Срок и наколки', '/faq/#srok-i-nakolki']] },
    { name: 'Ограбления', words: ['ограб', 'грабит', 'без сигнализац'], links: [['Как грабить без сигнализации', '/faq/#bez-signalizacii']] },
    { name: 'Ключи и двери', words: ['ключ', 'двер', 'отмычк'], links: [['Ключи и двери', '/faq/#klyuchi']] },
    { name: 'Заправка', words: ['заправк', 'скрытая комнат', 'скрытые комнат'], links: [['Скрытые комнаты на заправке', '/faq/#zapravka']] },
    { name: 'Вскрыть груз', words: ['вскрыт', 'ящик', 'груз'], links: [['Как вскрыть груз', '/faq/#vskryt-gruz'], ['Грузы и производство', '/mechanics/cargo/']] },
    { name: 'Плантация', words: ['плантац', 'рассад', 'куст'], links: [['Гайд: плантация', '/guides/plantation/']] },
    { name: 'Лаборатория', words: ['лаборатор', 'лаба', 'кристалл', 'весы'], links: [['Гайд: лаборатория', '/guides/lab/']] },
    { name: 'Машина', words: ['машин', 'тачк', 'тюнинг', 'багажник', 'авто'], links: [['Машина не появляется', '/faq/#svoya-mashina'], ['Модификация транспорта', '/guides/vehicle-mods/']] },
    { name: 'Коллекции', words: ['коллекци'], links: [['Гайд: коллекции', '/guides/collections/']] },
    { name: 'Кланы', words: ['клан', 'банд'], links: [['Кланы и войны банд', '/mechanics/clans/']] },
    { name: 'Карта', words: ['карт', 'где находится', 'лути-бей', 'лути бей'], links: [['Интерактивная карта', '/map/']] },
  ];

  // Варианты ответа. {quote} — сообщение игрока, {links} — ссылки.
  const TEMPLATES = [
    'Привет! Увидел твоё сообщение в чате:\n> {quote}\nВот тут как раз всё расписано:\n{links}\nЕсли что-то останется непонятным, пиши 🙂',
    'Привет! Ты спрашивал:\n> {quote}\nДумаю, это поможет:\n{links}\nНа robrun.info вообще собрано всё по игре, загляни, не пожалеешь!',
    'Хай! По твоему вопросу:\n> {quote}\nПосмотри здесь:\n{links}\nУдачи в игре!',
  ];
  const FALLBACK_TEMPLATE = 'Привет! Увидел твоё сообщение:\n> {quote}\nНа сайте {site} ты найдёшь всё, что нужно по игре: гайды, предметы, карту и ответы на частые вопросы. Загляни, не пожалеешь 🙂';

  // Предметы: [название, англ. название, id, есть на карте]. Обновляются командой tools/update-items.py
  const ITEMS = /*ITEMS-START*/[["JP-7 Mk1", "jp-7 mk1", "jp7_m1", 0], ["JP-7 Mk2", "jp-7 mk2", "jp7_m2", 0], ["JP-7 Mk3", "jp-7 mk3", "jp7_m3", 0], ["Спортивная сумка", "sports bag", "backpack_2", 0], ["Легкий бронежилет", "light body armor", "vest1_m1", 0], ["Универсальный подсумок", "versatile pouch", "belt_1", 0], ["Инъектор", "injector", "injector_1", 0], ["Патроны для штурмовой винтовки", "assault rifle ammo", "rifle_ammo_1", 1], ["Патроны для ПП", "smg ammo", "mp_ammo_1", 0], ["Патроны для дробовика", "shotgun ammo", "shotgun_ammo_1", 0], ["Средний бронежилет", "medium body armor", "vest2_m1", 0], ["Стальная пластина", "steel plate", "armor_plate_1", 0], ["Наличные", "cash", "cash_1", 1], ["DP-9 Mk1", "dp-9 mk1", "dp9_m1", 0], ["DP-9 Mk2", "dp-9 mk2", "dp9_m2", 1], ["Патроны для пистолета", "pistol ammo", "pistol_ammo_1", 0], ["KL-545 Mk1", "kl-545 mk1", "kl545_m1", 0], ["KL-545 Mk2", "kl-545 mk2", "kl545_m2", 0], ["KL-545 Mk3", "kl-545 mk3", "kl545_m3", 0], ["LM 249 Mk2", "lm 249 mk2", "lmg_m2", 0], ["CB45 Mk1", "cb45 mk1", "cb45_m1", 0], ["CB45 Mk2", "cb45 mk2", "cb45_m2", 0], ["CB45 Mk3", "cb45 mk3", "cb45_m3", 0], ["Полицейская рация", "police radio", "police_radio_1", 0], ["Отмычка", "lockpick", "lockpick_1", 0], ["Штурмовой бронежилет", "assault body armor", "vest3_m1", 0], ["Смартфон G-FLOW", "g-flow smartphone", "phone_1", 0], ["Смартфон D-MAX", "d-max smartphone", "phone_2", 0], ["Смартфон P-Verse", "p-verse smartphone", "phone_3", 0], ["Смартфон Flip Ring", "flip ring smartphone", "phone_4", 1], ["Телефон Tuver", "tuver phone", "phone_5", 0], ["Серьги GUDDI", "guddi earrings", "earrings_1", 0], ["Серьги AMINA", "amina earrings", "earrings_2", 1], ["Серьги SUGI", "sugi earrings", "earrings_3", 0], ["Серьги MAFFI", "maffi earrings", "earrings_4", 0], ["Серьги CHIPARDI", "chipardi earrings", "earrings_5", 0], ["Серьги MEKASSI", "mekassi earrings", "earrings_6", 0], ["Часы PEGIUET", "pegiuet watch", "watch_1", 0], ["Часы CONSTERAN", "consteran watch", "watch_2", 0], ["Часы PARDIN", "pardin watch", "watch_3", 0], ["Часы NURDAN", "nurdan watch", "watch_4", 1], ["Часы POLEX", "polex watch", "watch_5", 1], ["Часы PENARAI", "penarai watch", "watch_6", 0], ["Кольцо ALON GIA", "alon gia ring", "ring_1", 0], ["Кольцо AMINA", "amina ring", "ring_2", 0], ["Кольцо GUDDI", "guddi ring", "ring_3", 0], ["Кольцо SUGI", "sugi ring", "ring_4", 0], ["Кольцо MAFFI", "maffi ring", "ring_5", 1], ["Кольцо PRIDE", "pride ring", "ring_6", 1], ["Кольцо WISH", "wish ring", "ring_7", 0], ["Harris 500 Mk1", "harris 500 mk1", "harris500_m1", 0], ["Harris 500 Mk2", "harris 500 mk2", "harris500_m2", 0], ["Harris 500 Mk3", "harris 500 mk3", "harris500_m3", 0], ["Ожерелье ALON GIA", "alon gia necklace", "necklace_1", 0], ["Ожерелье GUDDI", "guddi necklace", "necklace_2", 1], ["Ожерелье MAFFI", "maffi necklace", "necklace_3", 0], ["Ожерелье REFIER", "refier necklace", "necklace_4", 0], ["Ожерелье CHIPARDI", "chipardi necklace", "necklace_5", 0], ["Ожерелье PENARAI", "penarai necklace", "necklace_6", 1], ["Ноутбук AIR-P", "air-p laptop", "laptop_1", 0], ["Ноутбук UTAB", "utab laptop", "laptop_2", 0], ["Ноутбук HUBRID", "hubrid laptop", "laptop_3", 0], ["Ноутбук PD STATION", "pd station laptop", "laptop_4", 1], ["Ноутбук MSR PRO", "msr pro laptop", "laptop_5", 0], ["Ноутбук SUS VILO", "sus vilo laptop", "laptop_6", 0], ["Консоль Key-Ten-Do", "key-ten-do console", "console_1", 0], ["Консоль X-STATION", "x-station console", "console_2", 0], ["Консоль ZTX", "ztx console", "console_3", 0], ["Консоль G-Cube", "g-cube console", "console_4", 1], ["Консоль X-STATION VR", "x-station vr console", "console_5", 0], ["Бутылка Black Pirate", "black pirate bottle", "alcohol_1", 1], ["Бутылка Krystal Light", "krystal light bottle", "alcohol_2", 1], ["Бутылка Diamond Breeze", "diamond breeze bottle", "alcohol_3", 1], ["Бутылка Happy Forester", "happy forester bottle", "alcohol_4", 0], ["Бутылка Golden Jaguar", "golden jaguar bottle", "alcohol_5", 1], ["Бутылка Eclipse", "eclipse bottle", "alcohol_6", 0], ["Бутылка Fine Wine", "fine wine bottle", "alcohol_7", 0], ["Бутылка Severka", "severka bottle", "alcohol_8", 0], ["Бутылка Omega", "omega bottle", "alcohol_9", 0], ["Бутылка Old Pocket", "old pocket bottle", "alcohol_10", 0], ["Бутылка Rosefield", "rosefield bottle", "alcohol_11", 0], ["Бутылка Krystal Authority", "krystal authority bottle", "alcohol_12", 0], ["Бутылка Amber Shift", "amber shift bottle", "alcohol_13", 0], ["Бутылка Velvet Dynasty", "velvet dynasty bottle", "alcohol_14", 0], ["Бутылка King’s Reserve", "king’s reserve bottle", "alcohol_15", 0], ["Тостер Goodhouse", "goodhouse toaster", "toaster_1", 0], ["Комикс HELGRIM", "helgrim comic book", "comics_1", 0], ["Комикс TADASHI", "tadashi comic book", "comics_2", 1], ["Комикс DIGITAL SOUL", "digital soul comic book", "comics_3", 1], ["Комикс KAIRO", "kairo comic book", "comics_4", 0], ["Комикс MASK", "mask comic book", "comics_5", 0], ["Журнал VERSIA", "versia magazine", "journal_1", 0], ["Журнал AURORA MODE", "aurora mode magazine", "journal_2", 0], ["Журнал MONOLITH", "monolith magazine", "journal_3", 0], ["Журнал VELVET RIOT", "velvet riot magazine", "journal_4", 1], ["Журнал OPALINE", "opaline magazine", "journal_5", 1], ["Фен SuperDryer", "superdryer hairdryer", "hairdryer_1", 0], ["Видеокарта HD X900", "hd x900 graphics card", "graphics_card_1", 0], ["Видеокарта RG 7700", "rg 7700 graphics card", "graphics_card_2", 0], ["Наушники AIRHEADS", "airheads headphones", "headphones_1", 1], ["Наушники MS MIC", "ms mic headphones", "headphones_2", 0], ["Наушники DS MAX", "ds max headphones", "headphones_3", 0], ["Наушники OMEGA", "omega headphones", "headphones_4", 0], ["Наушники Beat Head", "beat head headphones", "headphones_5", 0], ["Ключ от сейфа · в отеле Seasons района Санни-Бич", "safe key", "safe_key_1", 0], ["Ключ от сейфа · в отеле Reef района Санни-Бич", "safe key", "safe_key_2", 0], ["Ключ от сейфа · в стрип-клубе", "safe key", "safe_key_3", 0], ["Ключ от сейфа · в минимаркете на севере района Даунтаун", "safe key", "safe_key_4", 0], ["Ключ от сейфа · в аптеке района Санни-Бич", "safe key", "safe_key_5", 0], ["Ключ от сейфа · в кафе на пирсе района Санни-Бич", "safe key", "safe_key_6", 0], ["Ключ от сейфа · в особняке района Лорейн-Хиллз", "safe key", "safe_key_7", 0], ["Ключ от сейфа · в минимаркете в центре района Даунтаун", "safe key", "safe_key_8", 0], ["Ключ от сейфа · в минимаркете района Санни-Бич", "safe key", "safe_key_9", 0], ["Ключ от сейфа · в аптеке района Даунтаун", "safe key", "safe_key_10", 0], ["Ключ от сейфа · в кафе района Даунтаун", "safe key", "safe_key_11", 0], ["Ключ от сейфа · на заправке района Даунтаун", "safe key", "safe_key_12", 0], ["Ключ от сейфа · в магазине электроники района Санни-Бич", "safe key", "safe_key_13", 0], ["Ключ от сейфа · в одном из коттеджей района Лорейн-Хиллз", "safe key", "safe_key_14", 0], ["Ключ от комнаты · в оружейном магазине района Санни-Бич", "room key", "room_key_1", 0], ["Ключ от комнаты · в магазине экипировки района Санни-Бич", "room key", "room_key_2", 0], ["Ключ от комнаты · в оружейном магазине района Даунтаун", "room key", "room_key_3", 0], ["Ключ от комнаты · в магазине экипировки района Даунтаун", "room key", "room_key_4", 0], ["Ключ от комнаты · левая, на заправке района Даунтаун", "room key", "room_key_5", 0], ["Ключ от комнаты · правая, на заправке района Даунтаун", "room key", "room_key_6", 0], ["Ключ от комнаты · в одном из коттеджей района Лорейн-Хиллз", "room key", "room_key_7", 0], ["Ключ от комнаты · в аптеке района Даунтаун", "room key", "room_key_8", 0], ["Ключ от комнаты · в аптеке района Санни-Бич", "room key", "room_key_9", 0], ["Ключ от комнаты · в минимаркете района Даунтаун", "room key", "room_key_10", 0], ["Ключ от комнаты · в минимаркете района Санни-Бич", "room key", "room_key_11", 0], ["Ключ от комнаты · в одном из отелей района Санни-Бич", "room key", "room_key_12", 0], ["Ключ от комнаты · VIP, в стрип-клубе", "room key", "room_key_13", 0], ["Ключ-карта", "keycard", "vip_key_1", 0], ["ID-карта", "id card", "vip_key_4", 0], ["Камера EOS 900", "eos 900 camera", "camera_1", 0], ["Камера ISE S770", "ise s770 camera", "camera_2", 0], ["Камера CIRCUM 360", "circum 360 camera", "camera_3", 0], ["Градусник", "thermometer", "pharma_tools_1", 0], ["Микроскоп", "microscope", "pharma_tools_2", 0], ["Глюкометр", "glucometer", "pharma_tools_3", 0], ["Тонометр", "blood pressure monitor", "pharma_tools_4", 1], ["Бинокуляры", "dental loupes", "pharma_tools_5", 0], ["Офтальмоскоп", "ophthalmoscope", "pharma_tools_6", 0], ["Бижутерия", "costume jewelry", "jewelry_pouch_1", 1], ["Дешевые древности", "cheap antiques", "antique_set_1", 1], ["Картина", "painting", "picture_fake_1", 1], ["Электроника", "electronics", "electronics_box_1", 1], ["Алкоголь", "alcohol", "alcohol_box_1", 1], ["Автомобильные запчасти", "car parts", "car_spare_parts_1", 1], ["Медикаменты", "medications", "pharma_pack_1", 1], ["Набор карабинов", "carabiner set", "equip_carbine_1", 1], ["Стальной карабин", "steel carabiner", "equip_carbine_2", 0], ["Усиленный карабин", "reinforced carabiner", "equip_carbine_3", 0], ["Тактический карабин", "tactical carabiner", "equip_carbine_4", 0], ["Детали для оружия", "weapon parts", "weaponparts_box_1", 1], ["Базовый пороховой набор", "basic gunpowder kit", "gunpowder_1", 0], ["Стандартный пороховой набор", "standard gunpowder kit", "gunpowder_2", 0], ["Очищенный пороховой набор", "refined gunpowder kit", "gunpowder_3", 0], ["Гироскоп", "gyroscope", "weapon_trinket_1", 0], ["Баллистический хронограф", "ballistic chronograph", "weapon_trinket_2", 0], ["Пульт управления дроном", "drone controller", "weapon_trinket_3", 1], ["Современный компас", "modern compass", "weapon_trinket_4", 0], ["Тактический сенсор", "tactical sensor", "weapon_trinket_5", 0], ["Хронограф", "chronograph", "weapon_trinket_6", 0], ["Оружейный микрокомпьютер", "ballistics computer", "weapon_trinket_7", 0], ["RC 5.56 Mk1", "rc 5.56 mk1", "rc556_m1", 0], ["RC 5.56 Mk2", "rc 5.56 mk2", "rc556_m2", 0], ["RC 5.56 Mk3", "rc 5.56 mk3", "rc556_m3", 1], ["STAR-H Mk1", "star-h mk1", "starh_m1", 0], ["STAR-H Mk2", "star-h mk2", "starh_m2", 0], ["STAR-H Mk3", "star-h mk3", "starh_m3", 0], ["SR Reaper Mk1", "sr reaper mk1", "srreaper_m1", 0], ["SR Reaper Mk2", "sr reaper mk2", "srreaper_m2", 0], ["SR Reaper Mk3", "sr reaper mk3", "srreaper_m3", 0], ["AP Scalar Mk1", "ap scalar mk1", "apscalar_m1", 0], ["AP Scalar Mk2", "ap scalar mk2", "apscalar_m2", 0], ["AP Scalar Mk3", "ap scalar mk3", "apscalar_m3", 0], ["PDW90 Mk1", "pdw90 mk1", "pdw90_m1", 0], ["PDW90 Mk2", "pdw90 mk2", "pdw90_m2", 0], ["PDW90 Mk3", "pdw90 mk3", "pdw90_m3", 0], ["ORDR-12 Mk1", "ordr-12 mk1", "ordr12_m1", 0], ["ORDR-12 Mk2", "ordr-12 mk2", "ordr12_m2", 0], ["ORDR-12 Mk3", "ordr-12 mk3", "ordr12_m3", 0], ["LBR-44 Mk1", "lbr-44 mk1", "lbr44_m1", 0], ["LBR-44 Mk2", "lbr-44 mk2", "lbr44_m2", 0], ["Золотой слиток", "gold bar", "gold_bar_1", 1], ["Бриллиант в кейсе", "diamond in case", "gemstone_1", 0], ["Топаз в кейсе", "topaz in case", "gemstone_2", 0], ["Рубин в кейсе", "ruby in case", "gemstone_3", 1], ["Изумруд в кейсе", "emerald in case", "gemstone_4", 0], ["Аметист в кейсе", "amethyst in case", "gemstone_5", 0], ["Парфюм INFINITY", "infinity perfume", "perfume_1", 0], ["Парфюм FLERS", "flers perfume", "perfume_2", 1], ["Парфюм TRIO", "trio perfume", "perfume_3", 0], ["Парфюм LACROCAS", "lacrocas perfume", "perfume_4", 0], ["Парфюм DUCHEE", "duchee perfume", "perfume_5", 0], ["Платиновый диск", "platinum disc", "vinyl_1", 1], ["Золотой диск", "golden disc", "vinyl_2", 0], ["Презервативы Burex", "burex condoms", "condoms_1", 0], ["Презервативы Context", "context condoms", "condoms_2", 0], ["Презервативы Zipit", "zipit condoms", "condoms_3", 1], ["Презервативы LUX", "lux condoms", "condoms_4", 1], ["Презервативы Playgirl", "playgirl condoms", "condoms_5", 0], ["Карточка с Эйсоном Маккинли", "eason mckinley card", "baseball_card_1", 0], ["Карточка с Дэймоном Стриклендом", "damon strickland card", "baseball_card_2", 0], ["Карточка с Максвеллом Риверсом", "maxwell rivers card", "baseball_card_3", 0], ["Карточка с Трентом Карвером", "trent carver card", "baseball_card_4", 0], ["Карточка с Брэдли Сандерсоном", "bradley sanderson card", "baseball_card_5", 1], ["Карточка с Харли Вангером", "harley wanger card", "baseball_card_6", 0], ["Колода карт Poker Powerplay", "poker powerplay deck", "poker_cards_1", 0], ["Колода карт Mystic Card Chronicles", "mystic card chronicles deck", "poker_cards_2", 1], ["Колода карт Ace's Dominion", "ace's dominion deck", "poker_cards_3", 1], ["Колода карт Bad Habit", "bad habit deck", "poker_cards_4", 0], ["Колода карт Joker's Choice", "joker's choice deck", "poker_cards_5", 0], ["Пудра", "powder", "drugs_1", 1], ["Листовое сырье", "loose leaves", "drugs_2", 0], ["Колёса", "", "drugs_3", 0], ["Сахар", "sugar", "drugs_4", 0], ["Жевательные пластинки", "chewing gum", "drugs_5", 0], ["Брикет", "brick", "drugs_bricket_1", 1], ["Леденцы", "candy", "drugs_6", 0], ["Бур", "drill", "drill_1", 0], ["Мини-бур", "mini drill", "mini_drill_1", 0], ["Статуя божества", "deity statue", "antique_1", 1], ["Золотая статуя кошки", "golden cat statue", "antique_2", 1], ["Деревянная статуэтка", "wooden figure", "antique_3", 0], ["Каменная статуя девы", "stone maiden statue", "antique_4", 1], ["Деревянный тотем", "wooden totem", "antique_5", 0], ["Медный кувшин", "copper pitcher", "antique_6", 0], ["Игрушка CollectiToy #1", "collectitoy #1 figure", "toy_1", 0], ["Игрушка CollectiToy #2", "collectitoy #2 figure", "toy_2", 1], ["Игрушка CollectiToy #3", "collectitoy #3 figure", "toy_3", 0], ["Игрушка CollectiToy #4", "collectitoy #4 figure", "toy_4", 0], ["CollectiToy x TA", "collectitoy x ta", "toy_5", 0], ["Зажигалка Snap-Snap", "snap-snap lighter", "lighter_1", 0], ["Зажигалка Lerrou", "lerrou lighter", "lighter_2", 0], ["Зажигалка RedOlive", "redolive lighter", "lighter_3", 1], ["Зажигалка Clipper", "clipper lighter", "lighter_4", 0], ["Зажигалка SkyDragon", "skydragon lighter", "lighter_5", 0], ["Сигареты Lucky Shot", "lucky shot cigarettes", "cigar_1", 0], ["Сигары Old Huba", "old huba cigars", "cigar_2", 0], ["Сигареты KeKe", "keke cigarettes", "cigar_3", 0], ["Флакон с витаминами", "vial with supplements", "vial_1", 0], ["Флакон с жидкостью", "vial with liquid", "vial_2", 0], ["Флакон с вакциной", "vial with vaccine", "vial_3", 0], ["Флакон с редким лекарством", "vial with rare medicine", "vial_4", 0], ["Косметическая ампула", "cosmetic ampule", "vial_5", 1], ["Лекарственная ампула", "medicinal ampule", "vial_6", 0], ["Флакон с запрещенным лекарством", "vial with illegal drug", "vial_7", 0], ["Тяжелый бронежилет", "heavy body armor", "vest4_m1", 0], ["Бронежилет \"Бастион\"", "bastion body armor", "vest5_m1", 0], ["Обезболивающие", "painkillers", "painkiller_1", 1], ["AFAK", "afak", "afak_1", 0], ["Лазерный дальномер", "laser rangefinder", "equipment_1", 0], ["Бинокль", "binoculars", "equipment_2", 1], ["Тепловизор", "thermal imager", "equipment_3", 0], ["Индивидуальный сухой паек", "field ration", "equipment_4", 0], ["Мощный фонарик", "powerful flashlight", "equipment_5", 0], ["Бронежилет для собаки", "k9 body armor", "equipment_6", 0], ["Современный тактический бинокль", "modern tactical binoculars", "equipment_7", 0], ["Тактический бинокль", "tactical binoculars", "equipment_8", 0], ["Тактический мультитул", "tactical multitool", "equipment_9", 0], ["Премиальный мультитул", "premium multitool", "equipment_10", 0], ["Коллекционный мультитул", "collectible multitool", "equipment_11", 1], ["Переносной РЭБ", "portable ew system", "equipment_12", 0], ["Походная горелка", "camping stove", "burner_1", 0], ["Полевая горелка", "field stove", "burner_2", 1], ["Высокоточная горелка", "high-precision stove", "burner_3", 0], ["Набор для чистки оружия", "gun cleaning kit", "weapon_cleaning_1", 0], ["Профессиональный набор для чистки оружия", "professional gun cleaning kit", "weapon_cleaning_2", 1], ["Тактический набор для чистки оружия", "tactical gun cleaning kit", "weapon_cleaning_3", 0], ["Оружейная смазка", "gun grease", "gun_grease_1", 0], ["Профессиональная оружейная смазка", "professional gun grease", "gun_grease_2", 0], ["Синтетическая оружейная смазка", "synthetic gun grease", "gun_grease_3", 0], ["Коллекционный нож Imperial", "imperial collectible knife", "blade_1", 0], ["Коллекционный нож Aeron", "aeron collectible knife", "blade_2", 0], ["Коллекционный нож Streamline", "streamline collectible knife", "blade_3", 0], ["Коллекционный нож Cyber", "cyber collectible knife", "blade_4", 0], ["Коллекционный нож Nightfall", "nightfall collectible knife", "blade_5", 0], ["Коллекционный нож Shade", "shade collectible knife", "blade_6", 0], ["Меховые наручники", "fluffy handcuffs", "fluffy_cuffs_1", 0], ["Экзотический инструмент", "exotic tool", "dildo_1", 0], ["Значок Royal Motors", "royal motors emblem", "car_parts_1", 0], ["Автомобильная фара", "car headlight", "car_parts_2", 0], ["Домкрат", "jack", "car_parts_3", 0], ["DW-04", "dw-04", "car_parts_4", 0], ["Руль", "steering wheel", "car_parts_5", 1], ["Автомобильные свечи", "spark plugs", "car_parts_6", 0], ["Автомобильный компрессор", "car compressor", "car_parts_7", 0], ["Премиальный автомобильный компрессор", "premium car compressor", "car_parts_8", 1], ["Подвесные кубики", "hanging dice", "car_trinket_1", 0], ["Ароматизатор", "air freshener", "car_trinket_2", 0], ["Автомобильный парфюм", "car perfume", "car_trinket_3", 0], ["Брелок гонщика", "racer keychain", "car_trinket_4", 0], ["Бобблхед \"Питбуль\"", "pit bull bobblehead", "car_trinket_5", 0], ["Плюшевая игрушка на стекло", "plush car charm", "car_trinket_6", 0], ["Бюджетный видеорегистратор", "affordable dashcam", "car_device_1", 0], ["Бюджетная магнитола", "cheap car stereo", "car_device_2", 1], ["Видеорегистратор", "dashcam", "car_device_3", 0], ["Магнитола", "car stereo", "car_device_4", 0], ["Премиальный видеорегистратор", "premium dashcam", "car_device_5", 0], ["Премиальная магнитола", "premium car stereo", "car_device_6", 0], ["Осколочная граната", "frag grenade", "frag_grenade_1", 1], ["Газовая граната", "gas grenade", "gas_grenade_1", 1], ["Дымовая граната", "smoke grenade", "smoke_grenade_1", 1], ["Светошумовая граната", "flash grenade", "flash_grenade_1", 1], ["Мастер-ключ", "master key", "storage_lockpick_1", 0], ["TAG-12K Mk1", "tag-12k mk1", "tag12k_m1", 0], ["TAG-12K Mk2", "tag-12k mk2", "tag12k_m2", 0], ["TAG-12K Mk3", "tag-12k mk3", "tag12k_m3", 0], ["DRM-14 Mk1", "drm-14 mk1", "drm14_m1", 0], ["DRM-14 Mk2", "drm-14 mk2", "drm14_m2", 0], ["DRM-14 Mk3", "drm-14 mk3", "drm14_m3", 0], ["MC-10 Mk1", "mc-10 mk1", "mc10_m1", 0], ["MC-10 Mk2", "mc-10 mk2", "mc10_m2", 0], ["MC-10 Mk3", "mc-10 mk3", "mc10_m3", 0], ["Fukurou Tensa", "fukurou tensa", "fukurou_tensa", 0], ["Longhorn Van", "longhorn van", "longhorn_van", 0], ["Royal E", "royal e", "royal_e", 0], ["Longhorn Titan", "longhorn titan", "longhorn_titan", 0], ["Royal J", "royal j", "royal_j", 0], ["Longhorn Wild", "longhorn wild", "longhorn_wild", 0], ["Buletti Soltempra", "buletti soltempra", "buletti_soltempra", 1], ["Romanov R8", "romanov r8", "romanov_r8", 0], ["Трейлер", "trailer", "home_1", 0], ["Небольшой дом", "small house", "home_2", 0], ["Особняк", "mansion", "home_3", 0], ["Фермерский забор", "farm fence", "wall_1", 0], ["Сетчатый забор", "mesh fence", "wall_2", 0], ["Металлический забор", "metal fence", "wall_3", 0], ["Бетонный забор", "concrete fence", "wall_4", 0], ["Автогараж", "car garage", "car_garage_1", 0], ["Большой автогараж", "large car garage", "car_garage_2", 0], ["Вертолетная площадка", "helipad", "helicopter_garage_1", 0], ["crypto_farm_1", "", "crypto_farm_1", 0], ["Плантация", "grow room", "narco_farm_1", 0], ["Химическая лаборатория", "chemical laboratory", "meth_lab_1", 0], ["Склад", "warehouse", "storage_building_1", 0], ["Мастерская", "workshop", "workshop_building_1", 0], ["Автоподъемник", "car lift", "car_lift_1", 0], ["Верстак для вскрытия грузов", "cargo workbench", "cargo_workbench_1", 0], ["Лабораторный стол", "lab table", "cargo_workbench_lab_table_1", 0], ["Верстак для контрабанды", "contraband workbench", "cargo_exchange_workbench_1", 0], ["Малый сейф", "small safe", "storage_1", 0], ["Средний сейф", "medium safe", "storage_2", 0], ["Большой сейф", "large safe", "storage_3", 0], ["Малая тумба", "small nightstand", "storage_4", 0], ["Средняя тумба", "medium nightstand", "storage_5", 0], ["Большая тумба", "large nightstand", "storage_6", 0], ["Малый стеллаж", "small rack", "shelving_1", 0], ["Средний стеллаж", "medium rack", "shelving_2", 0], ["Большой стеллаж", "large rack", "shelving_3", 0], ["Малый стеллаж-клетка", "small security cabinet", "shelving_4", 0], ["Средний стеллаж-клетка", "medium security cabinet", "shelving_5", 0], ["Большой стеллаж-клетка", "large security cabinet", "shelving_6", 0], ["Стационарные тиски", "bench vise", "cargo_workbench_slot_1", 0], ["Слесарные инструменты", "locksmith tools", "cargo_workbench_toolbox_1", 0], ["Плазменный резак для вскрытия грузов", "plasma cargo cutter", "cargo_workbench_plasma_cutter_1", 0], ["Пила для вскрытия грузов", "cargo saw", "cargo_workbench_circular_saw_1", 0], ["Печатная машинка", "label printer", "cargo_exchange_workbench_speedup_upgrade_1", 0], ["Ящик с инструментами", "tool box", "cargo_exchange_workbench_additional_slot_upgrade", 0], ["Дополнительная коллекция", "additional collection", "collection_upgrade_1", 0], ["Особая коллекция", "special collection", "collection_upgrade_2", 0], ["Уникальная коллекция", "unique collection", "collection_upgrade_3", 0], ["Счетчик банкнот", "banknote counter", "money_workbench_speedup_1", 0], ["Мусор", "trash", "garbage_1", 0], ["Сломанная камера", "broken camera", "garbage_2", 0], ["Сломанный ноутбук", "broken laptop", "garbage_3", 0], ["Сломанный тостер", "broken toaster", "garbage_4", 0], ["Полицейское радио", "police radio", "car_police_radio_1", 0], ["ECU", "ecu", "car_ecu_1", 0], ["Улучшенный ECU", "improved ecu", "car_ecu_2", 0], ["Высокопроизводительный ECU", "high-performance ecu", "car_ecu_3", 0], ["Турбокомплект", "turbo kit", "car_turbocharger_1", 0], ["Улучшенный турбокомплект", "improved turbo kit", "car_turbocharger_2", 0], ["Интеркулер", "intercooler", "car_engine_cooling_1", 0], ["Улучшенный интеркулер", "improved intercooler", "car_engine_cooling_2", 0], ["Тормозной диск", "brake rotor", "car_suspension_1", 0], ["Гоночный диск", "racing rotor", "car_suspension_2", 0], ["Рулевая рейка", "steering rack", "car_steering_rack_1", 0], ["Усиленная рулевая рейка", "reinforced steering rack", "car_steering_rack_2", 0], ["Снаряд для гранатомета", "grenade launcher shell", "grenade_launcher_shell_1", 0], ["Ключи от яхты", "yacht key", "yacht_key_1", 0], ["Ультрафиолетовая лампа", "uv lamp", "uv_lamp_3", 0], ["Водяной насос", "water pump", "water_pump_2", 0], ["Вентилятор", "fan", "fan_1", 0], ["Улучшенный испаритель", "improved evaporator", "cargo_charge_workbench_upgrade_evaporator_1", 0], ["Качественный хладагент", "quality refrigerant", "cargo_charge_workbench_upgrade_refrigerant_1", 0], ["Химические весы", "laboratory scales", "cargo_open_workbench_upgrade_additional_slot_2", 0], ["Ключи от банковских ячеек", "deposit box keys", "deposit_box_1_cumulative", 0], ["USB-взломщик", "usb hacking tool", "usb_1_cumulative", 0], ["Кодовый планшет", "code tablet", "tablet_1_cumulative", 0], ["Грузовая ведомость", "cargo sheet", "cargo_manifest_1_cumulative", 0], ["Экшн-камера", "action camera", "action_camera_1_cumulative", 0], ["Багажные сумки", "trunk bags", "car_inventory_1", 0], ["Увеличенные багажные сумки", "large trunk bags", "car_inventory_2", 0], ["Вместительные багажные сумки", "spacious trunk bags", "car_inventory_3", 0], ["Багажный каркас", "cargo rack", "car_cargo_1", 0], ["Усиленный багажный каркас", "reinforced cargo rack", "car_cargo_2", 0], ["Электронный предохранитель", "electronic fuse", "defense_module_1", 0], ["Система охраны", "alarm system", "personal_alarm_1", 0], ["BIG EGG #53", "big egg #53", "egg_faberge_1", 1], ["Джеммер", "jammer", "auto_flipper_1", 0], ["Декодер", "decoder", "decoder_1", 0], ["Аптечка первой помощи", "first aid cabinet", "first_aid_cabinet_1", 0], ["Документ на поселение", "settlement title", "settlement_sale_1", 0], ["Документ на участок", "land plot title", "plot_sale_1", 0], ["Жетон сержанта", "sergeant's badge", "police_badge_1", 0], ["Жетон лейтенанта", "lieutenant's badge", "police_badge_2", 0], ["Жетон капитана", "captain's badge", "police_badge_3", 0], ["crypto_workbench_1", "", "crypto_workbench_1", 0], ["video_card_1", "", "video_card_1", 0], ["broken_video_card", "", "broken_video_card", 0], ["crypto_wallet", "", "crypto_wallet", 0], ["crypto_workbench_speedup_upgrade", "", "crypto_workbench_speedup_upgrade", 0], ["crypto_workbench_cooling_upgrade", "", "crypto_workbench_cooling_upgrade", 0], ["Химический реактор", "chemical reactor", "cargo_production_workbench_1", 0], ["Промышленный мотор", "industrial engine", "cargo_production_workbench_upgrade_engine_1", 0], ["Промышленный термометр", "industrial thermometer", "cargo_production_workbench_upgrade_thermometer_1", 0], ["Химический преобразователь", "chemical converter", "cargo_production_workbench_upgrade_converter_1", 0], ["Vulture 50 Mk1", "vulture 50 mk1", "vulture50_m1", 0], ["Vulture 50 Mk2", "vulture 50 mk2", "vulture50_m2", 0], ["Улики", "evidence", "police_evidence_1", 0], ["Стеклорез", "glass cutter", "glass_cutter_1", 0], ["Стол для рассады", "grow table", "cargo_charge_workbench_garden_bed", 0], ["Промышленный фризер", "industrial freezer", "cargo_charge_workbench_lab_freezer_1", 0], ["Лотерейный билет", "lottery ticket", "lottery_ticket_1", 0], ["Утерянный кошелек", "lost wallet", "wallet_1", 0], ["Хрупкая статуэтка", "fragile figurine", "figurine_1", 1], ["Пакет с посылкой", "parcel", "package_1", 0], ["Головоломка", "puzzle", "cube_1", 0], ["Пакет с урожаем", "harvest bag", "bush_drugs_1", 0], ["Кристаллический порошок", "crystalline powder", "lab_crystal_1", 0], ["Фишки", "chips", "roulette_chip_1", 0], ["Стол для коллекций", "collection table", "collection_table", 0], ["Право на выселение", "eviction right", "evict_plot_1", 0], ["Болторез", "bolt cutter", "bolt_cutter", 0], ["Банковская сумка с деньгами", "bank money bag", "bank_cash_bag", 0], ["Белый чемодан", "white", "suitcase", 0], ["Дорогой сейф", "expensive safe", "cargo_safe_legendary", 0], ["Закрытая сумка с деньгами", "closed money bag", "cash_bag", 0], ["Золотая статуя", "golden statue", "cargo_statue_1", 0], ["Канистры с реагентами", "reagent canisters", "reagents_1", 0], ["Качественные реагенты", "quality reagents", "reagents_2", 0], ["Контрабандный груз", "contraband cargo", "cargo_alcohol_grade_1", 0], ["Красный чемодан", "red suitcase", "suitcase_3", 0], ["Кристаллический концентрат", "crystalline concentrate", "soft_crystal_1", 0], ["Маленький сейф", "portable safe", "cargo_safe", 0], ["Премиальный груз", "premium cargo", "cargo_alcohol_grade_2", 0], ["Раритетный груз", "rarity cargo", "cargo_alcohol_grade_3", 0], ["Растущий куст", "growing bush", "bush_growing_1", 0], ["Синий чемодан", "blue suitcase", "suitcase_2", 0], ["Созревший куст", "mature bush", "bush_mature_1", 0], ["Сумка с идеальной пудрой", "perfect powder bag", "drugs_bag_2", 0], ["Сумка с пудрой", "powder bag", "drugs_bag_0", 0], ["Сумка с чистой пудрой", "pure powder bag", "drugs_bag_1", 0], ["Твердые кристаллы", "hard crystals", "hard_crystal_1", 0], ["Ценный груз", "valuable cargo", "valuable_cargo", 0], ["Ящик с алкоголем", "alcohol crate", "cargo_minimarket_common", 0], ["Ящик с запчастями", "spare parts crate", "cargo_carparts_common", 0], ["Ящик с коллекцией", "collection crate", "collection_reward_cargo_0", 0], ["Ящик с медикаментами", "medications crate", "cargo_medicine_common", 0], ["Ящик с оружейными деталями", "weapon parts box", "cargo_ammo_common", 0], ["Ящик с редкой коллекцией", "rare collection crate", "collection_reward_cargo_14", 0], ["Ящик с украшениями", "jewelry box", "cargo_jewelry_common", 0], ["Ящик с уникальной коллекцией", "unique collection crate", "collection_reward_cargo_24", 0], ["Ящик с экипировкой", "equipment crate", "cargo_equip_common", 0], ["Ящик с электроникой", "electronics crate", "cargo_electronics_common", 0]]/*ITEMS-END*/;

  // ======================= ПОИСК =======================
  const norm = (s) => ' ' + s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9?\- ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const has = (text, w) => text.includes(' ' + norm(w).trim());   // слово/корень с начала слова
  const stem = (w) => (w.length > 4 ? w.slice(0, -1) : w);
  const itemIndex = ITEMS.map(([ru, en, id, map]) => {
    const keys = [ru, en].filter((n) => n && n.length >= 5).map((n) => norm(n).trim().split(' ').map(stem).join(' '));
    return { ru, id, map, keys };
  }).filter((i) => i.keys.length);

  function findItem(text) {
    const words = text.trim().split(' ');
    let best = null;
    for (const it of itemIndex) {
      for (const k of it.keys) {
        const ks = k.split(' ');
        for (let i = 0; i + ks.length <= words.length; i++) {
          if (ks.every((s, j) => words[i + j].startsWith(s)) && (!best || k.length > best.len)) best = { it, len: k.length };
        }
      }
    }
    return best && best.it;
  }

  function analyze(raw) {
    const text = norm(raw);
    if (raw.trim().length < 8) return null;
    const isQuestion = QUESTION.some((q) => q === '?' ? raw.includes('?') : text.includes(' ' + q.trim()));
    if (!isQuestion) return null;
    const links = [];
    const topics = [];
    const item = findItem(text);
    if (item) {
      links.push([item.ru, `/items/${item.id}/`]);
      if (item.map) links.push([`${item.ru} на карте`, `/map/#find=${item.id}`]);
      topics.push('Предмет: ' + item.ru);
    }
    for (const t of TOPICS) {
      if (t.words.some((w) => has(text, w))) {
        topics.push(t.name);
        for (const l of t.links) if (!links.some((x) => x[1] === l[1])) links.push(l);
      }
    }
    if (links.length) return { topics, links: links.slice(0, MAX_LINKS) };
    if (HELP.some((h) => text.includes(' ' + h))) return { topics: ['Общий вопрос'], links: [] };
    return null;
  }

  function buildReply(raw, res) {
    const quote = raw.length > 160 ? raw.slice(0, 157) + '…' : raw;
    if (!res.links.length) return FALLBACK_TEMPLATE.replace('{quote}', quote).replace('{site}', SITE);
    const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const links = res.links.map(([n, u]) => `• ${n}: ${SITE}${u}`).join('\n');
    return tpl.replace('{quote}', quote.replace(/\n/g, ' ')).replace('{links}', links);
  }

  // ======================= ХРАНИЛИЩЕ (общее для всех вкладок) =======================
  const load = (k, d) => { try { return JSON.parse(GM_getValue(k, JSON.stringify(d))); } catch { return d; } };
  const save = (k, v) => GM_setValue(k, JSON.stringify(v));
  const seenIds = new Set();

  function addCard(card) {
    const cards = load('cards', []);
    if (cards.some((c) => c.msgId === card.msgId)) return;
    const users = load('users', {});
    const key = card.userId || card.author;
    if (users[key] && Date.now() - users[key] < SAME_USER_HOURS * 3600e3) return;
    users[key] = Date.now();
    save('users', users);
    cards.unshift(card);
    save('cards', cards.slice(0, 50));
    beep();
  }

  // ======================= ЧТЕНИЕ DISCORD =======================
  function readMessage(li) {
    const idm = li.id.match(/chat-messages-(\d+)-(\d+)/);
    if (!idm) return null;
    const [, channelId, msgId] = idm;
    const content = li.querySelector('[id^="message-content-"]');
    if (!content || li.querySelector('[class*="repliedTextContent"]') === content) return null;
    const raw = content.innerText.trim();
    const time = li.querySelector('time[datetime]');
    const ts = time ? Date.parse(time.getAttribute('datetime')) : Date.now();
    // автор: у сгруппированных сообщений шапки нет — ищем выше
    let head = li, author = '', userId = '';
    for (let i = 0; head && i < 30; i++, head = head.previousElementSibling) {
      const u = head.querySelector && head.querySelector('[id^="message-username-"] [class*="username"], [id^="message-username-"]');
      if (u) {
        author = u.innerText.trim();
        const av = head.querySelector('img[src*="/avatars/"]');
        const m = av && av.src.match(/avatars\/(\d+)\//);
        userId = m ? m[1] : '';
        break;
      }
    }
    const guild = (location.pathname.match(/channels\/([^/]+)/) || [])[1] || '@me';
    return { channelId, msgId, raw, ts, author, userId, guild };
  }

  function scan() {
    if (location.pathname.startsWith('/channels/@me')) return; // личку не читаем
    document.querySelectorAll('li[id^="chat-messages-"]').forEach((li) => {
      if (seenIds.has(li.id)) return;
      seenIds.add(li.id);
      const m = readMessage(li);
      if (!m || !m.raw) return;
      if (Date.now() - m.ts > MAX_AGE_MIN * 60e3) return;
      const res = analyze(m.raw);
      if (!res) return;
      addCard({
        ...m, topics: res.topics, reply: buildReply(m.raw, res),
        channel: (document.title || '').replace(/^\(\d+\)\s*/, '').split('|')[0].trim(),
        link: `https://discord.com/channels/${m.guild}/${m.channelId}/${m.msgId}`,
      });
    });
    checkScroll();
  }

  function checkScroll() {
    const last = [...document.querySelectorAll('li[id^="chat-messages-"]')].pop();
    let sc = last && last.parentElement;
    while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const up = sc && sc !== document.body && sc.scrollHeight - sc.scrollTop - sc.clientHeight > 400;
    warn.style.display = up ? 'block' : 'none';
  }

  // ======================= ЗВУК И ЗАГОЛОВОК =======================
  function beep() {
    if (!load('sound', true)) return;
    try {
      const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 660; g.gain.value = 0.05;
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.15);
    } catch {}
  }
  setInterval(() => {
    const n = load('cards', []).length;
    const t = document.title.replace(/^\[\d+\]\s*/, '');
    const want = n ? `[${n}] ${t}` : t;
    if (document.title !== want) document.title = want;
  }, 1500);

  // ======================= ПАНЕЛЬ =======================
  const css = document.createElement('style');
  css.textContent = `
  #rrh{--bg:#1c1c1b;--panel:#161615;--card:#262625;--border:#383735;--text:#f1f0ec;--muted:#9a9894;--accent:#c6f432;--ink:#121210;
    --display:"Fira Sans Extra Condensed","Roboto Condensed","Arial Narrow",sans-serif;--font:"Roboto Condensed","Arial Narrow",Arial,sans-serif;
    position:fixed;top:60px;right:12px;width:370px;max-height:80vh;z-index:99999;background:linear-gradient(180deg,#121211,#181817);color:var(--text);
    border:1px solid #2b2a28;border-left:4px solid var(--accent);font:500 13px/1.4 var(--font);letter-spacing:.1px;box-shadow:0 10px 40px #0009;display:flex;flex-direction:column}
  #rrh *{border-radius:0;box-sizing:border-box}
  #rrh.min #rrh-body,#rrh.min #rrh-warn{display:none}
  #rrh header{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #2b2a28}
  #rrh .brand{flex:1;font:italic 900 18px/1 var(--display);text-transform:uppercase;color:var(--accent)}
  #rrh .brand i{color:var(--text);font-style:italic}
  #rrh .mark{background:var(--accent);color:var(--ink);font:italic 900 13px/1 var(--display);padding:4px 6px;transform:skew(-8deg)}
  #rrh .count{background:var(--accent);color:var(--ink);font:italic 800 11px/1 var(--display);padding:3px 7px;transform:skew(-8deg)}
  #rrh .count:empty{display:none}
  #rrh button{background:#0f0f0e;color:var(--text);border:1px solid #33322f;padding:6px 10px;cursor:pointer;
    font:italic 800 12px/1 var(--display);text-transform:uppercase;letter-spacing:.3px;transform:skew(-8deg);transition:background .12s}
  #rrh button:hover{background:#2a2927;border-color:#4a4845}
  #rrh button.p{background:var(--accent);border-color:var(--accent);color:var(--ink)} #rrh button.p:hover{background:#d7ff5e}
  #rrh-body{overflow:auto;padding:10px;scrollbar-color:#383735 transparent}
  .rrc{background:#232322;border-left:3px solid transparent;padding:10px;margin-bottom:10px;transition:background .12s}
  .rrc:hover{background:#2d2c2a;border-left-color:var(--accent)}
  .rrc .who{font:italic 800 15px/1.1 var(--display);text-transform:uppercase}
  .rrc .t{color:var(--muted);font-size:11px} .rrc .tag{color:var(--accent);font:italic 700 11px var(--display);letter-spacing:1px;text-transform:uppercase;margin-top:2px}
  .rrc .m{background:#0f0f0e;border-left:3px solid var(--accent);padding:7px 8px;margin:8px 0;white-space:pre-wrap;word-break:break-word}
  .rrc textarea{width:100%;height:115px;background:#0f0f0e;color:#e6e4df;border:1px solid #2f2e2c;padding:6px;font:500 12px/1.4 var(--font);resize:vertical}
  .rrc textarea:focus{outline:1px solid var(--accent)}
  .rrc .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-left:3px}
  #rrh .empty{color:var(--muted);padding:6px 2px}
  #rrh-warn{display:none;background:var(--accent);color:var(--ink);padding:7px 12px;font:italic 800 12px/1.3 var(--display);text-transform:uppercase}`;
  document.head.appendChild(css);

  const panel = document.createElement('div');
  panel.id = 'rrh';
  panel.innerHTML = `<header><span class="mark">RR</span><span class="brand">Помощник<i>.</i>хелпера</span><span id="rrh-n" class="count"></span>
    <button id="rrh-snd" title="Звук"></button><button id="rrh-min">–</button></header>
    <div id="rrh-warn">⚠ Эта вкладка прокручена вверх, новые сообщения могут не видеться. Прокрутите чат вниз.</div>
    <div id="rrh-body"></div>`;
  document.body.appendChild(panel);
  const warn = panel.querySelector('#rrh-warn');
  const body = panel.querySelector('#rrh-body');
  if (load('min', false)) panel.classList.add('min');
  panel.querySelector('#rrh-min').onclick = (e) => { e.stopPropagation(); panel.classList.toggle('min'); save('min', panel.classList.contains('min')); };
  const snd = panel.querySelector('#rrh-snd');
  const drawSnd = () => (snd.textContent = load('sound', true) ? '🔔' : '🔕');
  snd.onclick = (e) => { e.stopPropagation(); save('sound', !load('sound', true)); drawSnd(); };
  drawSnd();

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    const cards = load('cards', []);
    panel.querySelector('#rrh-n').textContent = cards.length ? String(cards.length) : '';
    if (!cards.length) { body.innerHTML = '<div class="empty">Пока нет вопросов. Держите вкладки с каналами открытыми и прокрученными вниз.</div>'; return; }
    body.innerHTML = cards.map((c, i) => `<div class="rrc" data-i="${i}">
      <div><span class="who">${esc(c.author || 'Игрок')}</span> <span class="t">· ${esc(c.channel)} · ${new Date(c.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="tag">${esc(c.topics.join(' · '))}</div>
      <div class="m">${esc(c.raw)}</div>
      <textarea>${esc(c.reply)}</textarea>
      <div class="row">
        <button class="p" data-a="copy">Копировать</button>
        ${c.userId ? `<button data-a="profile">Профиль</button>` : `<button data-a="nick">Ник</button>`}
        <button data-a="msg">К сообщению</button>
        <button data-a="done">Готово</button>
      </div></div>`).join('');
  }

  body.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const el = b.closest('.rrc'); const i = +el.dataset.i;
    const cards = load('cards', []); const c = cards[i]; if (!c) return;
    const a = b.dataset.a;
    if (a === 'copy') { GM_setClipboard(el.querySelector('textarea').value); b.textContent = 'Скопировано ✓'; }
    if (a === 'nick') { GM_setClipboard(c.author); b.textContent = 'Ник скопирован ✓'; }
    if (a === 'profile') window.open(`https://discord.com/users/${c.userId}`, '_blank');
    if (a === 'msg') window.open(c.link, '_blank');
    if (a === 'done') { cards.splice(i, 1); save('cards', cards); }
  });

  GM_addValueChangeListener('cards', render);
  render();
  setInterval(scan, 2000);
})();
