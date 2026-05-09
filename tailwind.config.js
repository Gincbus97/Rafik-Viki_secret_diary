/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Готическая палитра
        ink:       '#0c0608',  // почти чёрный с пурпурным
        crypt:     '#140a0e',  // фон карточек
        velvet:    '#1d1014',  // подложки
        bone:      '#e8e2d4',  // основной текст
        ash:       '#a89c9b',  // вторичный текст
        blood:     '#8a0e1a',  // акцент
        bloodlight:'#c0233a',
        rose:      '#d8536e',  // милый акцент
        gold:      '#c8a96a',  // декор
        moon:      '#dcd0e3',  // лунный
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
        hand:    ['"Caveat"', 'cursive'],
      },
      boxShadow: {
        'crypt': '0 8px 28px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,169,106,0.08)',
        'glow':  '0 0 24px -4px rgba(192,35,58,0.45)',
      },
      backgroundImage: {
        'velvet-grad': 'radial-gradient(ellipse at top, #2a1018 0%, #0c0608 60%, #050203 100%)',
      },
    },
  },
  plugins: [],
};
