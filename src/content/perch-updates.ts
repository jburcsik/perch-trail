// "News from the Perch": press mentions, event recaps, milestones.
// Authored directly here (like Events) rather than through an admin UI.
// Keep newest-first. Translations are written by hand alongside the English.

import { LOCALES, type Locale as SiteLocale } from '@/i18n/locales'

export const CONTENT_LOCALES = LOCALES
export type Locale = SiteLocale

export type PerchUpdate = {
  /** Stable id, used as the card's #anchor. Never reuse or change once published. */
  slug: string
  /** ISO date (YYYY-MM-DD). */
  date: string
  title: Record<Locale, string>
  body: Record<Locale, string>
  /** Optional outbound link, e.g. to a press article. */
  link?: { url: string; label: Record<Locale, string> }
  /** Optional site-relative photo path. */
  photo?: string
}

export const PERCH_UPDATES: PerchUpdate[] = [
  {
    slug: 'ledger-front-page',
    date: '2026-07-20',
    title: {
      en: 'The Maple Hollow Ledger put us on the front page',
      fr: 'Le Maple Hollow Ledger nous a mis en une',
      vi: 'T\u1edd Maple Hollow Ledger \u0111\u01b0a ch\u00fang t\u00f4i l\u00ean trang nh\u1ea5t',
      'zh-Hans': '\u300aMaple Hollow Ledger\u300b\u628a\u6211\u4eec\u653e\u4e0a\u4e86\u5934\u7248',
      ar: '\u0635\u062d\u064a\u0641\u0629 \u2068Maple Hollow Ledger\u2069 \u0648\u0636\u0639\u062a\u0646\u0627 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0623\u0648\u0644\u0649',
    },
    body: {
      en: 'The Maple Hollow Ledger, the little community paper that lands in letterboxes once a month, came out to the Kiln Lane workshop in June. This month the trail is on the front page, with the rest of the story inside.\n\nThe piece gets the part that matters right: this started with one birdhouse on one fence, and the small bit of colour it put into the day. It also follows Priya Nandan as she paints her blue house on Ferry Steps, and counts the trail at 24 birdhouses on the map when the paper went to print. It is 31 now.\n\nThank you to the Ledger for coming out and telling it plainly.',
      fr: "Le Maple Hollow Ledger, le petit journal communautaire qui arrive dans les bo\u00eetes aux lettres une fois par mois, est venu \u00e0 l'atelier de Kiln Lane en juin. Ce mois-ci, le parcours est en une, et le reste de l'histoire se trouve \u00e0 l'int\u00e9rieur.\n\nL'article a bien saisi l'essentiel : tout a commenc\u00e9 avec un nichoir sur une cl\u00f4ture, et la petite touche de couleur qu'il a apport\u00e9e \u00e0 la journ\u00e9e. Il suit aussi Priya Nandan pendant qu'elle peint sa maison bleue sur Ferry Steps, et compte 24 nichoirs sur la carte au moment de l'impression. Il y en a 31 aujourd'hui.\n\nMerci au Ledger d'\u00eatre venu et d'avoir racont\u00e9 les choses simplement.",
      vi: 'T\u1edd Maple Hollow Ledger, t\u1edd b\u00e1o c\u1ed9ng \u0111\u1ed3ng nh\u1ecf \u0111\u01b0\u1ee3c b\u1ecf v\u00e0o h\u1ed9p th\u01b0 m\u1ed7i th\u00e1ng m\u1ed9t l\u1ea7n, \u0111\u00e3 \u0111\u1ebfn bu\u1ed5i v\u1ebd \u1edf Kiln Lane h\u1ed3i th\u00e1ng S\u00e1u. Th\u00e1ng n\u00e0y, h\u00e0nh tr\u00ecnh nh\u00e0 chim l\u00ean trang nh\u1ea5t, ph\u1ea7n c\u00f2n l\u1ea1i c\u1ee7a c\u00e2u chuy\u1ec7n n\u1eb1m \u1edf c\u00e1c trang trong.\n\nB\u00e0i b\u00e1o n\u1eafm \u0111\u00fang \u0111i\u1ec1u quan tr\u1ecdng nh\u1ea5t: m\u1ecdi th\u1ee9 b\u1eaft \u0111\u1ea7u t\u1eeb m\u1ed9t ng\u00f4i nh\u00e0 chim tr\u00ean m\u1ed9t h\u00e0ng r\u00e0o, v\u00e0 ch\u00fat m\u00e0u s\u1eafc nh\u1ecf m\u00e0 n\u00f3 mang l\u1ea1i cho m\u1ed9t ng\u00e0y. B\u00e0i c\u00f2n theo ch\u00e2n Priya Nandan khi c\u00f4 v\u1ebd ng\u00f4i nh\u00e0 m\u00e0u xanh \u1edf Ferry Steps, v\u00e0 \u0111\u1ebfm \u0111\u01b0\u1ee3c 24 nh\u00e0 chim tr\u00ean b\u1ea3n \u0111\u1ed3 l\u00fac b\u00e1o l\u00ean khu\u00f4n. Gi\u1edd \u0111\u00e3 l\u00e0 31.\n\nC\u1ea3m \u01a1n t\u1edd Ledger \u0111\u00e3 \u0111\u1ebfn v\u00e0 k\u1ec3 l\u1ea1i m\u1ecdi chuy\u1ec7n m\u1ed9t c\u00e1ch gi\u1ea3n d\u1ecb.',
      'zh-Hans': '\u300aMaple Hollow Ledger\u300b\u662f\u6bcf\u6708\u6295\u8fdb\u4fe1\u7bb1\u4e00\u6b21\u7684\u5c0f\u5c0f\u793e\u533a\u62a5\u3002\u516d\u6708\uff0c\u4ed6\u4eec\u6765\u5230\u4e86 Kiln Lane \u7684\u5f69\u7ed8\u5de5\u4f5c\u574a\u3002\u8fd9\u4e2a\u6708\uff0c\u5c0f\u5f84\u767b\u4e0a\u4e86\u5934\u7248\uff0c\u6545\u4e8b\u7684\u5176\u4f59\u90e8\u5206\u5728\u5185\u9875\u7ee7\u7eed\u3002\n\n\u62a5\u9053\u6293\u4f4f\u4e86\u6700\u8981\u7d27\u7684\u90a3\u4e00\u70b9\uff1a\u4e00\u5207\u59cb\u4e8e\u4e00\u9053\u7bf1\u7b06\u4e0a\u7684\u4e00\u4e2a\u9e1f\u5c4b\uff0c\u4ee5\u53ca\u5b83\u7ed9\u4e00\u5929\u5e26\u6765\u7684\u90a3\u4e00\u5c0f\u62b9\u989c\u8272\u3002\u6587\u7ae0\u8fd8\u8ddf\u968f Priya Nandan\uff0c\u8bb0\u5f55\u5979\u5728 Ferry Steps \u7ed8\u5236\u84dd\u8272\u5c0f\u5c4b\u7684\u8fc7\u7a0b\uff0c\u5e76\u5199\u5230\u4ed8\u5370\u65f6\u5730\u56fe\u4e0a\u6709 24 \u4e2a\u9e1f\u5c4b\u3002\u73b0\u5728\u5df2\u7ecf\u662f 31 \u4e2a\u4e86\u3002\n\n\u611f\u8c22 Ledger \u7684\u5230\u6765\uff0c\u611f\u8c22\u4ed6\u4eec\u628a\u6545\u4e8b\u8bb2\u5f97\u8fd9\u4e48\u5e73\u5b9e\u3002',
      ar: '\u0635\u062d\u064a\u0641\u0629 \u2068Maple Hollow Ledger\u2069\u060c \u0627\u0644\u062c\u0631\u064a\u062f\u0629 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0627\u0644\u0635\u063a\u064a\u0631\u0629 \u0627\u0644\u062a\u064a \u062a\u0635\u0644 \u0625\u0644\u0649 \u0635\u0646\u0627\u062f\u064a\u0642 \u0627\u0644\u0628\u0631\u064a\u062f \u0645\u0631\u0629 \u0641\u064a \u0627\u0644\u0634\u0647\u0631\u060c \u062d\u0636\u0631\u062a \u0648\u0631\u0634\u0629 \u2068Kiln Lane\u2069 \u0641\u064a \u062d\u0632\u064a\u0631\u0627\u0646/\u064a\u0648\u0646\u064a\u0648. \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631\u060c \u0627\u0644\u0645\u0633\u0627\u0631 \u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0623\u0648\u0644\u0649\u060c \u0648\u0628\u0642\u064a\u0629 \u0627\u0644\u0642\u0635\u0629 \u0641\u064a \u0627\u0644\u062f\u0627\u062e\u0644.\n\n\u0623\u0635\u0627\u0628 \u0627\u0644\u0645\u0642\u0627\u0644 \u0627\u0644\u062c\u0632\u0621 \u0627\u0644\u0645\u0647\u0645: \u0628\u062f\u0623 \u0643\u0644 \u0634\u064a\u0621 \u0628\u0628\u064a\u062a \u0637\u064a\u0648\u0631 \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0633\u064a\u0627\u062c \u0648\u0627\u062d\u062f\u060c \u0648\u0627\u0644\u0644\u0645\u0633\u0629 \u0627\u0644\u0635\u063a\u064a\u0631\u0629 \u0645\u0646 \u0627\u0644\u0644\u0648\u0646 \u0627\u0644\u062a\u064a \u0623\u0636\u0627\u0641\u0647\u0627 \u0625\u0644\u0649 \u0627\u0644\u064a\u0648\u0645. \u064a\u062a\u0627\u0628\u0639 \u0627\u0644\u0645\u0642\u0627\u0644 \u0623\u064a\u0636\u064b\u0627 \u2068Priya Nandan\u2069 \u0648\u0647\u064a \u062a\u0631\u0633\u0645 \u0628\u064a\u062a\u0647\u0627 \u0627\u0644\u0623\u0632\u0631\u0642 \u0641\u064a \u2068Ferry Steps\u2069\u060c \u0648\u064a\u062d\u0635\u064a 24 \u0628\u064a\u062a \u0637\u064a\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u0639\u0646\u062f \u0627\u0644\u0637\u0628\u0627\u0639\u0629. \u0635\u0627\u0631 \u0627\u0644\u0639\u062f\u062f 31 \u0627\u0644\u0622\u0646.\n\n\u0634\u0643\u0631\u064b\u0627 \u0644\u0644\u0640\u2068Ledger\u2069 \u0639\u0644\u0649 \u0627\u0644\u062d\u0636\u0648\u0631 \u0648\u0639\u0644\u0649 \u0631\u0648\u0627\u064a\u0629 \u0627\u0644\u0642\u0635\u0629 \u0628\u0628\u0633\u0627\u0637\u0629.',
    },
    link: {
      url: 'https://perchtrail.example/press/ledger-july',
      label: {
        en: 'Read the story in the Ledger',
        fr: "Lire l'article dans le Ledger",
        vi: '\u0110\u1ecdc b\u00e0i tr\u00ean t\u1edd Ledger',
        'zh-Hans': '\u9605\u8bfb Ledger \u7684\u62a5\u9053',
        ar: '\u0627\u0642\u0631\u0623 \u0627\u0644\u0642\u0635\u0629 \u0641\u064a \u2068Ledger\u2069',
      },
    },
  },
  {
    slug: 'orchard-row-kickoff',
    date: '2026-05-17',
    title: {
      en: 'Our first afternoon: the Orchard Row kick-off',
      fr: 'Notre premier apr\u00e8s-midi : le lancement sur Orchard Row',
      vi: 'Bu\u1ed5i chi\u1ec1u \u0111\u1ea7u ti\u00ean: kh\u1edfi \u0111\u1ed9ng \u1edf Orchard Row',
      'zh-Hans': '\u6211\u4eec\u7684\u7b2c\u4e00\u4e2a\u4e0b\u5348\uff1aOrchard Row \u542f\u52a8\u65e5',
      ar: '\u0623\u0648\u0644 \u0639\u0635\u0631\u064a\u0629 \u0644\u0646\u0627: \u0627\u0646\u0637\u0644\u0627\u0642\u0629 \u2068Orchard Row\u2069',
    },
    body: {
      en: 'Perch Trail kicked off for real on May 16th, right outside Hollow Oven Bakery on Orchard Row. Brushes out, buns in hand, and the block turned into one big open-air paint studio for an afternoon.\n\nBig thanks to the bakery for hosting, and to everyone who pulled up a chair and made something. This is exactly what we hoped it would look like.',
      fr: "Perch Trail a vraiment d\u00e9marr\u00e9 le 16 mai, juste devant la boulangerie Hollow Oven sur Orchard Row. Pinceaux sortis, brioches en main, et le p\u00e2t\u00e9 de maisons s'est transform\u00e9 en un grand atelier de peinture \u00e0 ciel ouvert pour un apr\u00e8s-midi.\n\nUn grand merci \u00e0 la boulangerie de nous avoir accueillis, et \u00e0 tous ceux qui ont pris une chaise et cr\u00e9\u00e9 quelque chose. C'est exactement ce qu'on esp\u00e9rait.",
      vi: 'Perch Trail ch\u00ednh th\u1ee9c kh\u1edfi \u0111\u1ed9ng v\u00e0o ng\u00e0y 16 th\u00e1ng N\u0103m, ngay tr\u01b0\u1edbc ti\u1ec7m b\u00e1nh Hollow Oven tr\u00ean Orchard Row. C\u1ecd trong tay, b\u00e1nh trong tay, v\u00e0 c\u1ea3 d\u00e3y ph\u1ed1 bi\u1ebfn th\u00e0nh m\u1ed9t x\u01b0\u1edfng v\u1ebd ngo\u00e0i tr\u1eddi trong su\u1ed1t bu\u1ed5i chi\u1ec1u.\n\nC\u1ea3m \u01a1n ti\u1ec7m b\u00e1nh \u0111\u00e3 l\u00e0m n\u01a1i t\u1ed5 ch\u1ee9c, v\u00e0 c\u1ea3m \u01a1n t\u1ea5t c\u1ea3 nh\u1eefng ai \u0111\u00e3 k\u00e9o gh\u1ebf ng\u1ed3i xu\u1ed1ng v\u00e0 t\u1ea1o n\u00ean m\u1ed9t \u0111i\u1ec1u g\u00ec \u0111\u00f3. \u0110\u00e2y \u0111\u00fang l\u00e0 nh\u1eefng g\u00ec ch\u00fang t\u00f4i mong \u0111\u1ee3i.',
      'zh-Hans': '5 \u6708 16 \u65e5\uff0cPerch Trail \u5728 Orchard Row \u7684 Hollow Oven \u9762\u5305\u5e97\u95e8\u53e3\u6b63\u5f0f\u542f\u52a8\u3002\u753b\u7b14\u5728\u624b\uff0c\u9762\u5305\u5728\u624b\uff0c\u6574\u6761\u8857\u5728\u4e00\u4e2a\u4e0b\u5348\u53d8\u6210\u4e86\u4e00\u95f4\u9732\u5929\u753b\u5ba4\u3002\n\n\u975e\u5e38\u611f\u8c22\u9762\u5305\u5e97\u63d0\u4f9b\u573a\u5730\uff0c\u4e5f\u611f\u8c22\u6bcf\u4e00\u4f4d\u62c9\u628a\u6905\u5b50\u5750\u4e0b\u6765\u52a8\u624b\u521b\u4f5c\u7684\u670b\u53cb\u3002\u8fd9\u6b63\u662f\u6211\u4eec\u671f\u5f85\u7684\u6837\u5b50\u3002',
      ar: '\u0627\u0646\u0637\u0644\u0642 \u2068Perch Trail\u2069 \u0641\u0639\u0644\u064a\u064b\u0627 \u0641\u064a \u0627\u0644\u0633\u0627\u062f\u0633 \u0639\u0634\u0631 \u0645\u0646 \u0623\u064a\u0627\u0631/\u0645\u0627\u064a\u0648\u060c \u0623\u0645\u0627\u0645 \u0645\u062e\u0628\u0632 \u2068Hollow Oven\u2069 \u0645\u0628\u0627\u0634\u0631\u0629\u064b \u0641\u064a \u2068Orchard Row\u2069. \u0627\u0644\u0641\u064f\u0631\u064e\u0634 \u0641\u064a \u0627\u0644\u0623\u064a\u062f\u064a\u060c \u0648\u0627\u0644\u0643\u0639\u0643 \u0641\u064a \u0627\u0644\u0623\u064a\u062f\u064a \u0627\u0644\u0623\u062e\u0631\u0649\u060c \u0648\u062a\u062d\u0648\u0651\u0644 \u0627\u0644\u062d\u064a \u0625\u0644\u0649 \u0645\u0631\u0633\u0645 \u0645\u0641\u062a\u0648\u062d \u0641\u064a \u0627\u0644\u0647\u0648\u0627\u0621 \u0627\u0644\u0637\u0644\u0642 \u0637\u0648\u0627\u0644 \u0627\u0644\u0639\u0635\u0631.\n\n\u0634\u0643\u0631\u064b\u0627 \u062c\u0632\u064a\u0644\u064b\u0627 \u0644\u0644\u0645\u062e\u0628\u0632 \u0639\u0644\u0649 \u0627\u0644\u0627\u0633\u062a\u0636\u0627\u0641\u0629\u060c \u0648\u0644\u0643\u0644 \u0645\u0646 \u0633\u062d\u0628 \u0643\u0631\u0633\u064a\u064b\u0627 \u0648\u0635\u0646\u0639 \u0634\u064a\u0626\u064b\u0627. \u0647\u0630\u0627 \u062a\u0645\u0627\u0645\u064b\u0627 \u0645\u0627 \u0643\u0646\u0627 \u0646\u0623\u0645\u0644 \u0623\u0646 \u064a\u0628\u062f\u0648 \u0639\u0644\u064a\u0647 \u0627\u0644\u0623\u0645\u0631.',
    },
  },
  {
    slug: 'website-launch',
    date: '2026-05-02',
    title: {
      en: 'The website is live',
      fr: 'Le site web est en ligne',
      vi: 'Trang web \u0111\u00e3 ho\u1ea1t \u0111\u1ed9ng',
      'zh-Hans': '\u7f51\u7ad9\u5df2\u4e0a\u7ebf',
      ar: '\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0623\u0635\u0628\u062d \u0645\u062a\u0627\u062d\u064b\u0627',
    },
    body: {
      en: 'It took about three months of building, and rebuilding, to get perchtrail.example just right. A map of the whole trail, a story page for every birdhouse, and five languages so the whole neighbourhood can read it in their own.\n\nThis is the foundation everything else is built on. Welcome to the trail.',
      fr: "Il aura fallu environ trois mois de construction, et de reconstruction, pour que perchtrail.example soit exactement comme on le voulait. Une carte de tout le parcours, une page d'histoire pour chaque nichoir, et cinq langues pour que tout le quartier puisse lire dans la sienne.\n\nC'est la base sur laquelle tout le reste est construit. Bienvenue sur le parcours.",
      vi: 'Ph\u1ea3i m\u1ea5t kho\u1ea3ng ba th\u00e1ng x\u00e2y d\u1ef1ng, r\u1ed3i x\u00e2y l\u1ea1i, \u0111\u1ec3 perchtrail.example tr\u1edf n\u00ean \u0111\u00fang nh\u01b0 mong mu\u1ed1n. M\u1ed9t b\u1ea3n \u0111\u1ed3 cho c\u1ea3 h\u00e0nh tr\u00ecnh, m\u1ed9t trang c\u00e2u chuy\u1ec7n cho m\u1ed7i nh\u00e0 chim, v\u00e0 n\u0103m ng\u00f4n ng\u1eef \u0111\u1ec3 c\u1ea3 khu ph\u1ed1 c\u00f3 th\u1ec3 \u0111\u1ecdc b\u1eb1ng ti\u1ebfng c\u1ee7a m\u00ecnh.\n\n\u0110\u00e2y l\u00e0 n\u1ec1n t\u1ea3ng cho m\u1ecdi th\u1ee9 kh\u00e1c. Ch\u00e0o m\u1eebng \u0111\u1ebfn v\u1edbi h\u00e0nh tr\u00ecnh.',
      'zh-Hans': '\u6211\u4eec\u82b1\u4e86\u5927\u7ea6\u4e09\u4e2a\u6708\u53cd\u590d\u642d\u5efa\u3001\u8c03\u6574\uff0c\u624d\u8ba9 perchtrail.example \u8fbe\u5230\u7406\u60f3\u7684\u6837\u5b50\u3002\u4e00\u5f20\u8bb0\u5f55\u6574\u6761\u5c0f\u5f84\u7684\u5730\u56fe\uff0c\u6bcf\u4e2a\u9e1f\u5c4b\u90fd\u6709\u81ea\u5df1\u7684\u6545\u4e8b\u9875\u9762\uff0c\u8fd8\u652f\u6301\u4e94\u79cd\u8bed\u8a00\uff0c\u8ba9\u6574\u4e2a\u793e\u533a\u90fd\u80fd\u7528\u81ea\u5df1\u719f\u6089\u7684\u8bed\u8a00\u9605\u8bfb\u3002\n\n\u8fd9\u662f\u4e00\u5207\u7684\u57fa\u7840\u3002\u6b22\u8fce\u6765\u5230\u8fd9\u6761\u5c0f\u5f84\u3002',
      ar: '\u0627\u0633\u062a\u063a\u0631\u0642 \u0627\u0644\u0623\u0645\u0631 \u0646\u062d\u0648 \u062b\u0644\u0627\u062b\u0629 \u0623\u0634\u0647\u0631 \u0645\u0646 \u0627\u0644\u0628\u0646\u0627\u0621 \u0648\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0628\u0646\u0627\u0621 \u062d\u062a\u0649 \u064a\u0635\u0628\u062d \u2068perchtrail.example\u2069 \u0639\u0644\u0649 \u0627\u0644\u0634\u0643\u0644 \u0627\u0644\u0630\u064a \u0623\u0631\u062f\u0646\u0627\u0647. \u062e\u0631\u064a\u0637\u0629 \u0644\u0644\u0645\u0633\u0627\u0631 \u0628\u0623\u0643\u0645\u0644\u0647\u060c \u0648\u0635\u0641\u062d\u0629 \u0642\u0635\u0629 \u0644\u0643\u0644 \u0628\u064a\u062a \u0637\u064a\u0648\u0631\u060c \u0648\u062e\u0645\u0633 \u0644\u063a\u0627\u062a \u0644\u064a\u062a\u0645\u0643\u0646 \u0627\u0644\u062d\u064a \u0643\u0644\u0647 \u0645\u0646 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0628\u0644\u063a\u062a\u0647.\n\n\u0647\u0630\u0627 \u0647\u0648 \u0627\u0644\u0623\u0633\u0627\u0633 \u0627\u0644\u0630\u064a \u064a\u0642\u0648\u0645 \u0639\u0644\u064a\u0647 \u0643\u0644 \u0634\u064a\u0621 \u0622\u062e\u0631. \u0623\u0647\u0644\u064b\u0627 \u0628\u0643\u0645 \u0641\u064a \u0627\u0644\u0645\u0633\u0627\u0631.',
    },
  },
]

/** Newest-first, regardless of the array's own order. */
export function sortNewestFirst(posts: PerchUpdate[]): PerchUpdate[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date))
}

/** The N most recent posts, newest-first; used by the homepage teaser. */
export function latestUpdates(posts: PerchUpdate[], count: number): PerchUpdate[] {
  return sortNewestFirst(posts).slice(0, count)
}
