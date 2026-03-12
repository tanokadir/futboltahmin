# Futbolcu Kim? - Online Deploy Talimatları

## 1. GitHub'a Yükle

1. GitHub.com'da yeni bir repo oluştur → "futbolcu-kim"
2. Zip'i aç, içindekileri repo'ya yükle:
   - server.js
   - package.json
   - render.yaml
   - public/index.html

## 2. Render.com'da Deploy Et (ÜCRETSİZ)

1. render.com → "Sign Up" (GitHub ile giriş)
2. "New +" → "Web Service"
3. GitHub repo'nu seç → "Connect"
4. Ayarlar otomatik gelir (render.yaml'dan):
   - Name: futbolcu-kim
   - Build: npm install
   - Start: node server.js
5. "Create Web Service" tıkla
6. ~2 dakika sonra URL alırsın:
   https://futbolcu-kim.onrender.com

## 3. Oyna!

- Arkadaşına linki gönder
- "Online Multi" → "Oda Oluştur"
- 5 haneli kodu paylaş
- 2-4 kişi katılabilir
- Host "Oyunu Başlat" der → 5 tur başlar!

## Özellikler
- Her turda aynı futbolcu → herkes yarışır
- 30 saniye süre
- 5 tahmin hakkı, her yanlış bir ipucu açar
- İlk doğru bilen tam puan, diğerleri 0
- 5 tur sonunda final sıralaması

## NOT
Render ücretsiz planda sunucu 15 dakika boşta kalırsa uyur.
İlk bağlantıda 30-60 saniye yavaş açılabilir (uyanıyor).
Sürekli aktif olsun istersen $7/ay planına geç.
