/**
 * useLanguageCodeLookup - composable + data for ISO 639 language code lookup.
 *
 * Provides bidirectional search between ISO 639-1 (2-letter), 639-2 (3-letter
 * bibliographic), 639-3 (3-letter) codes and language names.
 *
 * No external dependencies - uses a bundled subset of the ISO 639 standard.
 */
import { ref, computed, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface LanguageEntry {
  iso6391: string;
  iso6392: string;
  iso6393: string;
  name: string;
  nativeName?: string;
}

export interface UseLanguageCodeLookupReturn {
  query: Ref<string>;
  results: Ref<LanguageEntry[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Data - ISO 639 language codes (common subset)                              */
/* -------------------------------------------------------------------------- */

export const LANGUAGES: LanguageEntry[] = [
  { iso6391: 'aa', iso6392: 'aar', iso6393: 'aar', name: 'Afar', nativeName: 'Afaraf' },
  { iso6391: 'ab', iso6392: 'abk', iso6393: 'abk', name: 'Abkhazian', nativeName: 'Аҧсуа бызшәа' },
  { iso6391: 'af', iso6392: 'afr', iso6393: 'afr', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { iso6391: 'ak', iso6392: 'aka', iso6393: 'aka', name: 'Akan', nativeName: 'Akan' },
  { iso6391: 'am', iso6392: 'amh', iso6393: 'amh', name: 'Amharic', nativeName: 'አማርኛ' },
  { iso6391: 'ar', iso6392: 'ara', iso6393: 'ara', name: 'Arabic', nativeName: 'العربية' },
  { iso6391: 'as', iso6392: 'asm', iso6393: 'asm', name: 'Assamese', nativeName: 'অসমীয়া' },
  { iso6391: 'av', iso6392: 'ava', iso6393: 'ava', name: 'Avaric', nativeName: 'авар мацӀ' },
  { iso6391: 'ay', iso6392: 'aym', iso6393: 'aym', name: 'Aymara', nativeName: 'aymar aru' },
  { iso6391: 'az', iso6392: 'aze', iso6393: 'aze', name: 'Azerbaijani', nativeName: 'Azərbaycan dili' },
  { iso6391: 'ba', iso6392: 'bak', iso6393: 'bak', name: 'Bashkir', nativeName: 'башҡорт теле' },
  { iso6391: 'be', iso6392: 'bel', iso6393: 'bel', name: 'Belarusian', nativeName: 'Беларуская' },
  { iso6391: 'bg', iso6392: 'bul', iso6393: 'bul', name: 'Bulgarian', nativeName: 'български език' },
  { iso6391: 'bh', iso6392: 'bih', iso6393: 'bih', name: 'Bihari languages', nativeName: 'भोजपुरी' },
  { iso6391: 'bi', iso6392: 'bis', iso6393: 'bis', name: 'Bislama', nativeName: 'Bislama' },
  { iso6391: 'bm', iso6392: 'bam', iso6393: 'bam', name: 'Bambara', nativeName: 'bamanankan' },
  { iso6391: 'bn', iso6392: 'ben', iso6393: 'ben', name: 'Bengali', nativeName: 'বাংলা' },
  { iso6391: 'bo', iso6392: 'tib', iso6393: 'bod', name: 'Tibetan', nativeName: 'བོད་སྐད' },
  { iso6391: 'br', iso6392: 'bre', iso6393: 'bre', name: 'Breton', nativeName: 'brezhoneg' },
  { iso6391: 'bs', iso6392: 'bos', iso6393: 'bos', name: 'Bosnian', nativeName: 'bosanski jezik' },
  { iso6391: 'ca', iso6392: 'cat', iso6393: 'cat', name: 'Catalan', nativeName: 'català' },
  { iso6391: 'ce', iso6392: 'che', iso6393: 'che', name: 'Chechen', nativeName: 'нохчийн мотт' },
  { iso6391: 'ch', iso6392: 'cha', iso6393: 'cha', name: 'Chamorro', nativeName: 'Chamoru' },
  { iso6391: 'co', iso6392: 'cos', iso6393: 'cos', name: 'Corsican', nativeName: 'corsu' },
  { iso6391: 'cr', iso6392: 'cre', iso6393: 'cre', name: 'Cree', nativeName: 'ᓀᐦᐃᔭᐍᐏᐣ' },
  { iso6391: 'cs', iso6392: 'cze', iso6393: 'ces', name: 'Czech', nativeName: 'čeština' },
  { iso6391: 'cu', iso6392: 'chu', iso6393: 'chu', name: 'Church Slavic', nativeName: 'ѩзыкъ словѣньскъ' },
  { iso6391: 'cv', iso6392: 'chv', iso6393: 'chv', name: 'Chuvash', nativeName: 'чӑваш чӗлхи' },
  { iso6391: 'cy', iso6392: 'wel', iso6393: 'cym', name: 'Welsh', nativeName: 'Cymraeg' },
  { iso6391: 'da', iso6392: 'dan', iso6393: 'dan', name: 'Danish', nativeName: 'dansk' },
  { iso6391: 'de', iso6392: 'ger', iso6393: 'deu', name: 'German', nativeName: 'Deutsch' },
  { iso6391: 'dv', iso6392: 'div', iso6393: 'div', name: 'Dhivehi', nativeName: 'ދިވެހި' },
  { iso6391: 'dz', iso6392: 'dzo', iso6393: 'dzo', name: 'Dzongkha', nativeName: 'རྫོང་ཁ' },
  { iso6391: 'ee', iso6392: 'ewe', iso6393: 'ewe', name: 'Ewe', nativeName: 'Eʋegbe' },
  { iso6391: 'el', iso6392: 'gre', iso6393: 'ell', name: 'Greek', nativeName: 'Ελληνικά' },
  { iso6391: 'en', iso6392: 'eng', iso6393: 'eng', name: 'English', nativeName: 'English' },
  { iso6391: 'eo', iso6392: 'epo', iso6393: 'epo', name: 'Esperanto', nativeName: 'Esperanto' },
  { iso6391: 'es', iso6392: 'spa', iso6393: 'spa', name: 'Spanish', nativeName: 'Español' },
  { iso6391: 'et', iso6392: 'est', iso6393: 'est', name: 'Estonian', nativeName: 'eesti' },
  { iso6391: 'eu', iso6392: 'baq', iso6393: 'eus', name: 'Basque', nativeName: 'euskara' },
  { iso6391: 'fa', iso6392: 'per', iso6393: 'fas', name: 'Persian', nativeName: 'فارسی' },
  { iso6391: 'ff', iso6392: 'ful', iso6393: 'ful', name: 'Fulah', nativeName: 'Fulfulde' },
  { iso6391: 'fi', iso6392: 'fin', iso6393: 'fin', name: 'Finnish', nativeName: 'suomi' },
  { iso6391: 'fj', iso6392: 'fij', iso6393: 'fij', name: 'Fijian', nativeName: 'vosa Vakaviti' },
  { iso6391: 'fo', iso6392: 'fao', iso6393: 'fao', name: 'Faroese', nativeName: 'føroyskt' },
  { iso6391: 'fr', iso6392: 'fre', iso6393: 'fra', name: 'French', nativeName: 'Français' },
  { iso6391: 'fy', iso6392: 'fry', iso6393: 'fry', name: 'Western Frisian', nativeName: 'Frysk' },
  { iso6391: 'ga', iso6392: 'gle', iso6393: 'gle', name: 'Irish', nativeName: 'Gaeilge' },
  { iso6391: 'gd', iso6392: 'gla', iso6393: 'gla', name: 'Scottish Gaelic', nativeName: 'Gàidhlig' },
  { iso6391: 'gl', iso6392: 'glg', iso6393: 'glg', name: 'Galician', nativeName: 'galego' },
  { iso6391: 'gn', iso6392: 'grn', iso6393: 'grn', name: 'Guarani', nativeName: 'Avañeẽ' },
  { iso6391: 'gu', iso6392: 'guj', iso6393: 'guj', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { iso6391: 'gv', iso6392: 'glv', iso6393: 'glv', name: 'Manx', nativeName: 'Gaelg' },
  { iso6391: 'ha', iso6392: 'hau', iso6393: 'hau', name: 'Hausa', nativeName: 'Hausa' },
  { iso6391: 'he', iso6392: 'heb', iso6393: 'heb', name: 'Hebrew', nativeName: 'עברית' },
  { iso6391: 'hi', iso6392: 'hin', iso6393: 'hin', name: 'Hindi', nativeName: 'हिन्दी' },
  { iso6391: 'hr', iso6392: 'hrv', iso6393: 'hrv', name: 'Croatian', nativeName: 'hrvatski' },
  { iso6391: 'ht', iso6392: 'hat', iso6393: 'hat', name: 'Haitian Creole', nativeName: 'Kreyòl ayisyen' },
  { iso6391: 'hu', iso6392: 'hun', iso6393: 'hun', name: 'Hungarian', nativeName: 'magyar' },
  { iso6391: 'hy', iso6392: 'arm', iso6393: 'hye', name: 'Armenian', nativeName: 'Հայերեն' },
  { iso6391: 'hz', iso6392: 'her', iso6393: 'her', name: 'Herero', nativeName: 'Otjiherero' },
  { iso6391: 'id', iso6392: 'ind', iso6393: 'ind', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { iso6391: 'ig', iso6392: 'ibo', iso6393: 'ibo', name: 'Igbo', nativeName: 'Igbo' },
  { iso6391: 'ii', iso6392: 'iii', iso6393: 'iii', name: 'Sichuan Yi', nativeName: 'ꆈꌠꉙ' },
  { iso6391: 'ik', iso6392: 'ipk', iso6393: 'ipk', name: 'Inupiaq', nativeName: 'Iñupiaq' },
  { iso6391: 'is', iso6392: 'ice', iso6393: 'isl', name: 'Icelandic', nativeName: 'Íslenska' },
  { iso6391: 'it', iso6392: 'ita', iso6393: 'ita', name: 'Italian', nativeName: 'Italiano' },
  { iso6391: 'iu', iso6392: 'iku', iso6393: 'iku', name: 'Inuktitut', nativeName: 'ᐃᓄᒃᑎᑐᑦ' },
  { iso6391: 'ja', iso6392: 'jpn', iso6393: 'jpn', name: 'Japanese', nativeName: '日本語' },
  { iso6391: 'jv', iso6392: 'jav', iso6393: 'jav', name: 'Javanese', nativeName: 'Basa Jawa' },
  { iso6391: 'ka', iso6392: 'geo', iso6393: 'kat', name: 'Georgian', nativeName: 'ქართული' },
  { iso6391: 'kk', iso6392: 'kaz', iso6393: 'kaz', name: 'Kazakh', nativeName: 'қазақ тілі' },
  { iso6391: 'kl', iso6392: 'kal', iso6393: 'kal', name: 'Kalaallisut', nativeName: 'kalaallisut' },
  { iso6391: 'km', iso6392: 'khm', iso6393: 'khm', name: 'Khmer', nativeName: 'ខ្មែរ' },
  { iso6391: 'kn', iso6392: 'kan', iso6393: 'kan', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { iso6391: 'ko', iso6392: 'kor', iso6393: 'kor', name: 'Korean', nativeName: '한국어' },
  { iso6391: 'ks', iso6392: 'kas', iso6393: 'kas', name: 'Kashmiri', nativeName: 'कश्मीरी' },
  { iso6391: 'ku', iso6392: 'kur', iso6393: 'kur', name: 'Kurdish', nativeName: 'Kurdî' },
  { iso6391: 'kv', iso6392: 'kom', iso6393: 'kom', name: 'Komi', nativeName: 'коми кыв' },
  { iso6391: 'kw', iso6392: 'cor', iso6393: 'cor', name: 'Cornish', nativeName: 'Kernewek' },
  { iso6391: 'ky', iso6392: 'kir', iso6393: 'kir', name: 'Kyrgyz', nativeName: 'кыргыз тили' },
  { iso6391: 'la', iso6392: 'lat', iso6393: 'lat', name: 'Latin', nativeName: 'latine' },
  { iso6391: 'lb', iso6392: 'ltz', iso6393: 'ltz', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch' },
  { iso6391: 'lg', iso6392: 'lug', iso6393: 'lug', name: 'Ganda', nativeName: 'Luganda' },
  { iso6391: 'ln', iso6392: 'lin', iso6393: 'lin', name: 'Lingala', nativeName: 'Lingála' },
  { iso6391: 'lo', iso6392: 'lao', iso6393: 'lao', name: 'Lao', nativeName: 'ລາວ' },
  { iso6391: 'lt', iso6392: 'lit', iso6393: 'lit', name: 'Lithuanian', nativeName: 'lietuvių kalba' },
  { iso6391: 'lv', iso6392: 'lav', iso6393: 'lav', name: 'Latvian', nativeName: 'latviešu valoda' },
  { iso6391: 'mg', iso6392: 'mlg', iso6393: 'mlg', name: 'Malagasy', nativeName: 'fiteny malagasy' },
  { iso6391: 'mh', iso6392: 'mah', iso6393: 'mah', name: 'Marshallese', nativeName: 'Kajin M̧ajeļ' },
  { iso6391: 'mi', iso6392: 'mao', iso6393: 'mri', name: 'Maori', nativeName: 'te reo Māori' },
  { iso6391: 'mk', iso6392: 'mac', iso6393: 'mkd', name: 'Macedonian', nativeName: 'македонски јазик' },
  { iso6391: 'ml', iso6392: 'mal', iso6393: 'mal', name: 'Malayalam', nativeName: 'മലയാളം' },
  { iso6391: 'mn', iso6392: 'mon', iso6393: 'mon', name: 'Mongolian', nativeName: 'монгол хэл' },
  { iso6391: 'mr', iso6392: 'mar', iso6393: 'mar', name: 'Marathi', nativeName: 'मराठी' },
  { iso6391: 'ms', iso6392: 'may', iso6393: 'msa', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { iso6391: 'mt', iso6392: 'mlt', iso6393: 'mlt', name: 'Maltese', nativeName: 'Malti' },
  { iso6391: 'my', iso6392: 'bur', iso6393: 'mya', name: 'Burmese', nativeName: 'ဗမာစာ' },
  { iso6391: 'na', iso6392: 'nau', iso6393: 'nau', name: 'Nauru', nativeName: 'Ekakairũ Naoero' },
  { iso6391: 'nb', iso6392: 'nob', iso6393: 'nob', name: 'Norwegian Bokmål', nativeName: 'Norsk Bokmål' },
  { iso6391: 'nd', iso6392: 'nde', iso6393: 'nde', name: 'North Ndebele', nativeName: 'isiNdebele' },
  { iso6391: 'ne', iso6392: 'nep', iso6393: 'nep', name: 'Nepali', nativeName: 'नेपाली' },
  { iso6391: 'nl', iso6392: 'dut', iso6393: 'nld', name: 'Dutch', nativeName: 'Nederlands' },
  { iso6391: 'nn', iso6392: 'nno', iso6393: 'nno', name: 'Norwegian Nynorsk', nativeName: 'Norsk Nynorsk' },
  { iso6391: 'no', iso6392: 'nor', iso6393: 'nor', name: 'Norwegian', nativeName: 'Norsk' },
  { iso6391: 'nr', iso6392: 'nbl', iso6393: 'nbl', name: 'South Ndebele', nativeName: 'isiNdebele' },
  { iso6391: 'nv', iso6392: 'nav', iso6393: 'nav', name: 'Navajo', nativeName: 'Diné bizaad' },
  { iso6391: 'ny', iso6392: 'nya', iso6393: 'nya', name: 'Chichewa', nativeName: 'chiCheŵa' },
  { iso6391: 'oc', iso6392: 'oci', iso6393: 'oci', name: 'Occitan', nativeName: 'occitan' },
  { iso6391: 'om', iso6392: 'orm', iso6393: 'orm', name: 'Oromo', nativeName: 'Afaan Oromoo' },
  { iso6391: 'or', iso6392: 'ori', iso6393: 'ori', name: 'Oriya', nativeName: 'ଓଡ଼ିଆ' },
  { iso6391: 'os', iso6392: 'oss', iso6393: 'oss', name: 'Ossetian', nativeName: 'ирон æвзаг' },
  { iso6391: 'pa', iso6392: 'pan', iso6393: 'pan', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { iso6391: 'pl', iso6392: 'pol', iso6393: 'pol', name: 'Polish', nativeName: 'polski' },
  { iso6391: 'ps', iso6392: 'pus', iso6393: 'pus', name: 'Pashto', nativeName: 'پښتو' },
  { iso6391: 'pt', iso6392: 'por', iso6393: 'por', name: 'Portuguese', nativeName: 'Português' },
  { iso6391: 'qu', iso6392: 'que', iso6393: 'que', name: 'Quechua', nativeName: 'Runa Simi' },
  { iso6391: 'rm', iso6392: 'roh', iso6393: 'roh', name: 'Romansh', nativeName: 'rumantsch' },
  { iso6391: 'rn', iso6392: 'run', iso6393: 'run', name: 'Kirundi', nativeName: 'Ikirundi' },
  { iso6391: 'ro', iso6392: 'rum', iso6393: 'ron', name: 'Romanian', nativeName: 'română' },
  { iso6391: 'ru', iso6392: 'rus', iso6393: 'rus', name: 'Russian', nativeName: 'русский' },
  { iso6391: 'rw', iso6392: 'kin', iso6393: 'kin', name: 'Kinyarwanda', nativeName: 'Ikinyarwanda' },
  { iso6391: 'sa', iso6392: 'san', iso6393: 'san', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { iso6391: 'sc', iso6392: 'srd', iso6393: 'srd', name: 'Sardinian', nativeName: 'sardu' },
  { iso6391: 'sd', iso6392: 'snd', iso6393: 'snd', name: 'Sindhi', nativeName: 'सिन्धी' },
  { iso6391: 'se', iso6392: 'sme', iso6393: 'sme', name: 'Northern Sami', nativeName: 'Davvisámegiella' },
  { iso6391: 'sg', iso6392: 'sag', iso6393: 'sag', name: 'Sango', nativeName: 'yângâ tî sängö' },
  { iso6391: 'si', iso6392: 'sin', iso6393: 'sin', name: 'Sinhala', nativeName: 'සිංහල' },
  { iso6391: 'sk', iso6392: 'slo', iso6393: 'slk', name: 'Slovak', nativeName: 'slovenčina' },
  { iso6391: 'sl', iso6392: 'slv', iso6393: 'slv', name: 'Slovenian', nativeName: 'slovenščina' },
  { iso6391: 'sm', iso6392: 'smo', iso6393: 'smo', name: 'Samoan', nativeName: 'gagana faa Samoa' },
  { iso6391: 'sn', iso6392: 'sna', iso6393: 'sna', name: 'Shona', nativeName: 'chiShona' },
  { iso6391: 'so', iso6392: 'som', iso6393: 'som', name: 'Somali', nativeName: 'Soomaaliga' },
  { iso6391: 'sq', iso6392: 'alb', iso6393: 'sqi', name: 'Albanian', nativeName: 'Shqip' },
  { iso6391: 'sr', iso6392: 'srp', iso6393: 'srp', name: 'Serbian', nativeName: 'српски језик' },
  { iso6391: 'ss', iso6392: 'swa', iso6393: 'swa', name: 'Swati', nativeName: 'SiSwati' },
  { iso6391: 'st', iso6392: 'sot', iso6393: 'sot', name: 'Southern Sotho', nativeName: 'Sesotho' },
  { iso6391: 'su', iso6392: 'sun', iso6393: 'sun', name: 'Sundanese', nativeName: 'Basa Sunda' },
  { iso6391: 'sv', iso6392: 'swe', iso6393: 'swe', name: 'Swedish', nativeName: 'svenska' },
  { iso6391: 'sw', iso6392: 'swa', iso6393: 'swa', name: 'Swahili', nativeName: 'Kiswahili' },
  { iso6391: 'ta', iso6392: 'tam', iso6393: 'tam', name: 'Tamil', nativeName: 'தமிழ்' },
  { iso6391: 'te', iso6392: 'tel', iso6393: 'tel', name: 'Telugu', nativeName: 'తెలుగు' },
  { iso6391: 'tg', iso6392: 'tgk', iso6393: 'tgk', name: 'Tajik', nativeName: 'тоҷикӣ' },
  { iso6391: 'th', iso6392: 'tha', iso6393: 'tha', name: 'Thai', nativeName: 'ไทย' },
  { iso6391: 'ti', iso6392: 'tir', iso6393: 'tir', name: 'Tigrinya', nativeName: 'ትግርኛ' },
  { iso6391: 'tk', iso6392: 'tuk', iso6393: 'tuk', name: 'Turkmen', nativeName: 'Türkmen' },
  { iso6391: 'tl', iso6392: 'tgl', iso6393: 'tgl', name: 'Tagalog', nativeName: 'Wikang Tagalog' },
  { iso6391: 'tn', iso6392: 'tsn', iso6393: 'tsn', name: 'Tswana', nativeName: 'Setswana' },
  { iso6391: 'to', iso6392: 'ton', iso6393: 'ton', name: 'Tongan', nativeName: 'faka Tonga' },
  { iso6391: 'tr', iso6392: 'tur', iso6393: 'tur', name: 'Turkish', nativeName: 'Türkçe' },
  { iso6391: 'ts', iso6392: 'tso', iso6393: 'tso', name: 'Tsonga', nativeName: 'Xitsonga' },
  { iso6391: 'tt', iso6392: 'tat', iso6393: 'tat', name: 'Tatar', nativeName: 'татар теле' },
  { iso6391: 'ty', iso6392: 'tah', iso6393: 'tah', name: 'Tahitian', nativeName: 'Reo Tahiti' },
  { iso6391: 'ug', iso6392: 'uig', iso6393: 'uig', name: 'Uyghur', nativeName: 'ئۇيغۇرچە' },
  { iso6391: 'uk', iso6392: 'ukr', iso6393: 'ukr', name: 'Ukrainian', nativeName: 'українська' },
  { iso6391: 'ur', iso6392: 'urd', iso6393: 'urd', name: 'Urdu', nativeName: 'اردو' },
  { iso6391: 'uz', iso6392: 'uzb', iso6393: 'uzb', name: 'Uzbek', nativeName: 'Oʻzbek' },
  { iso6391: 've', iso6392: 'ven', iso6393: 'ven', name: 'Venda', nativeName: 'Tshivenḓa' },
  { iso6391: 'vi', iso6392: 'vie', iso6393: 'vie', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { iso6391: 'vo', iso6392: 'vol', iso6393: 'vol', name: 'Volapük', nativeName: 'Volapük' },
  { iso6391: 'wa', iso6392: 'wln', iso6393: 'wln', name: 'Walloon', nativeName: 'walon' },
  { iso6391: 'wo', iso6392: 'wol', iso6393: 'wol', name: 'Wolof', nativeName: 'Wollof' },
  { iso6391: 'xh', iso6392: 'xho', iso6393: 'xho', name: 'Xhosa', nativeName: 'isiXhosa' },
  { iso6391: 'yi', iso6392: 'yid', iso6393: 'yid', name: 'Yiddish', nativeName: 'ייִדיש' },
  { iso6391: 'yo', iso6392: 'yor', iso6393: 'yor', name: 'Yoruba', nativeName: 'Yorùbá' },
  { iso6391: 'za', iso6392: 'zha', iso6393: 'zha', name: 'Zhuang', nativeName: 'Saɯ cueŋƅ' },
  { iso6391: 'zh', iso6392: 'chi', iso6393: 'zho', name: 'Chinese', nativeName: '中文' },
  { iso6391: 'zu', iso6392: 'zul', iso6393: 'zul', name: 'Zulu', nativeName: 'isiZulu' },
];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** Search languages by code or name (case-insensitive). */
export function searchLanguages(query: string): LanguageEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return LANGUAGES;
  return LANGUAGES.filter((l) => {
    return (
      l.iso6391.toLowerCase().includes(q) ||
      l.iso6392.toLowerCase().includes(q) ||
      l.iso6393.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      (l.nativeName?.toLowerCase().includes(q) ?? false)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useLanguageCodeLookup(): UseLanguageCodeLookupReturn {
  const query = ref<string>('');
  const results = computed(() => searchLanguages(query.value)) as unknown as Ref<LanguageEntry[]>;

  function reset(): void {
    query.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
    },
    output: results,
    toOutput: () => ({ results: results.value }),
  });

  return {
    query,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
