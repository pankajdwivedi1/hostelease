const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFile = path.join(__dirname, 'public', 'logo.jpeg');
const outputDir = path.join(__dirname, 'public');

async function generateIcons() {
    console.log('Generating PWA icons...');

    for (const size of sizes) {
        const outputFile = path.join(outputDir, `icon-${size}x${size}.png`);

        await sharp(inputFile)
            .resize(size, size, {
                fit: 'cover',
                position: 'center'
            })
            .png()
            .toFile(outputFile);

        console.log(`✓ Generated ${size}x${size} icon`);
    }

    // Also create apple-touch-icon
    await sharp(inputFile)
        .resize(180, 180, {
            fit: 'cover',
            position: 'center'
        })
        .png()
        .toFile(path.join(outputDir, 'apple-touch-icon.png'));

    console.log('✓ Generated apple-touch-icon.png');
    console.log('\n✅ All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
