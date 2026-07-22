import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Clean and retrieve title
    const rawTitle = searchParams.get('title') || 'Grace Daily';
    const title = rawTitle.replace(/\s+/g, ' ').trim();
    
    // Clean and retrieve description
    const rawDescription = searchParams.get('description') || 'Renungan Harian Kristen';
    const cleanDescription = rawDescription.replace(/\s+/g, ' ').trim();
    
    // Truncate description to prevent banner height overflow (maximum of 95 characters)
    const maxDescLength = 95;
    const description = cleanDescription.length > maxDescLength
      ? cleanDescription.slice(0, maxDescLength - 3) + '...'
      : cleanDescription;


    const bgParamRaw = searchParams.get('bg') || 'cream';
    let bgParam = bgParamRaw;
    
    // Define beautiful background, text, and border themes
    const colorThemes: Record<string, { bg: string; title: string; desc: string; border: string }> = {
      // 7 Neon/Stabilo themes with high-contrast black border and font
      'neon-yellow': { bg: '#FFFF00', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-green': { bg: '#39FF14', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-pink': { bg: '#FF8AD8', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-orange': { bg: '#FFAD33', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-cyan': { bg: '#00FFFF', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-lime': { bg: '#CCFF00', title: '#000000', desc: '#000000', border: '#000000' },
      'neon-purple': { bg: '#E2B3FF', title: '#000000', desc: '#000000', border: '#000000' },
      
      // 4 New requested background themes
      'white': { bg: '#FFFFFF', title: '#000000', desc: '#000000', border: '#000000' },
      'facebook-blue': { bg: '#1877F2', title: '#FFFFFF', desc: '#FFFFFF', border: '#FFFFFF' },
      'moss-green': { bg: '#3D5446', title: '#FAF7F2', desc: '#FAF7F2', border: '#FAF7F2' },
      'spotify-green': { bg: '#1DB954', title: '#191414', desc: '#191414', border: '#191414' },

      cream: { bg: '#FAF7F2', title: '#43382D', desc: '#786858', border: 'rgba(67, 56, 45, 0.15)' },
      sage: { bg: '#E6ECE6', title: '#2D3A2D', desc: '#5A6C5A', border: 'rgba(45, 58, 45, 0.15)' },
      blue: { bg: '#E6ECF2', title: '#233343', desc: '#4F6378', border: 'rgba(35, 51, 67, 0.15)' },
      rose: { bg: '#ECE6EC', title: '#3E2D3E', desc: '#725772', border: 'rgba(62, 45, 62, 0.15)' },
      amber: { bg: '#F8F3E9', title: '#4C3C2C', desc: '#8C745C', border: 'rgba(76, 60, 44, 0.15)' },
      gray: { bg: '#F1F3F5', title: '#2F353C', desc: '#5E6770', border: 'rgba(47, 53, 60, 0.15)' },
      // Landing page specific colors
      green: { bg: '#e9f5db', title: '#14213d', desc: '#284b3a', border: 'rgba(20, 33, 61, 0.15)' },
      teal: { bg: '#2a6f6f', title: '#ffffff', desc: '#e9f5db', border: 'rgba(233, 245, 219, 0.25)' },
      beige: { bg: '#f7f4ee', title: '#14213d', desc: '#52606d', border: 'rgba(20, 33, 61, 0.15)' },
      warmwhite: { bg: '#fffdf8', title: '#14213d', desc: '#334155', border: 'rgba(20, 33, 61, 0.12)' },
      dark: { bg: '#14213d', title: '#fffdf8', desc: '#dfd8ca', border: 'rgba(255, 253, 248, 0.2)' },
    };

    const isAuto = bgParam === 'auto-stabilo';
    if (isAuto) {
      const day = new Date().getDay(); // 0 to 6 (Sunday to Saturday)
      const stabiloKeys = ['neon-yellow', 'neon-green', 'neon-pink', 'neon-orange', 'neon-cyan', 'neon-lime', 'neon-purple'];
      bgParam = stabiloKeys[day];
    }
    
    const theme = colorThemes[bgParam] || colorThemes.cream;
    
    // Resolve logo image: try loading locally as Base64 to avoid DNS loopback issues in production edge, fallback to absolute URL
    let logoUrl = '';
    try {
      const logoBuffer = await fetch(
        new URL('../../../../../public/logo.png', import.meta.url)
      ).then((res) => res.arrayBuffer());
      const logoBase64 = Buffer.from(logoBuffer).toString('base64');
      logoUrl = `data:image/png;base64,${logoBase64}`;
    } catch (err) {
      console.warn('[generate-image] Gagal membaca logo secara lokal, fallback ke URL absolut:', err);
      const origin = request.nextUrl.origin;
      logoUrl = `${origin}/logo.png`;
    }
    
    let icon = searchParams.get('icon') || '⛪';
    
    const format = searchParams.get('format') || 'horizontal';
    const isVertical = format === 'vertical';
 
    const width = isVertical ? 1080 : 1200;
    const height = isVertical ? 1920 : 630;
 
    // Determine font sizes dynamically based on format
    let titleFontSize = isVertical ? '90px' : '48px';
    if (title.length > 40) {
      titleFontSize = isVertical ? '72px' : '36px';
    }
    if (title.length > 70) {
      titleFontSize = isVertical ? '60px' : '30px';
    }
 
    let descFontSize = isVertical ? '45px' : '24px';
    if (description.length > 70) {
      descFontSize = isVertical ? '36px' : '20px';
    }
 
    const logoWidth = isVertical ? 360 : 180;
    const logoHeight = isVertical ? 130 : 65; // enlarged, keeping aspect ratio
    const logoMargin = isVertical ? '40px' : '12px';
    const iconSize = isVertical ? '140px' : '60px';
  
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.bg,
            padding: isVertical ? '48px' : '28px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `4px solid ${theme.border}`,
              borderRadius: isVertical ? '36px' : '20px',
              padding: isVertical ? '80px' : '40px',
              boxSizing: 'border-box',
            }}
          >
            {icon === 'logo' ? (
              <img
                src={logoUrl}
                width={logoWidth}
                height={logoHeight}
                style={{
                  marginBottom: logoMargin,
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
                alt="Logo"
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  fontSize: iconSize,
                  marginBottom: logoMargin,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            
            <h1
              style={{
                fontSize: titleFontSize,
                fontWeight: 'bold',
                color: theme.title,
                textAlign: 'center',
                lineHeight: 1.2,
                marginBottom: isVertical ? '40px' : '12px',
                maxWidth: '92%',
                flexShrink: 0,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: descFontSize,
                fontWeight: 600,
                color: theme.desc,
                textAlign: 'center',
                maxWidth: '92%',
                lineHeight: 1.35,
                flexShrink: 0,
              }}
            >
              {description}
            </p>
          </div>
        </div>
      ),
      {
        width: width,
        height: height,
        headers: {
          'Content-Disposition': 'inline; filename="devotion-banner.png"',
          'Cache-Control': isAuto 
            ? 'public, max-age=86400, must-revalidate'
            : 'public, max-age=31536000, immutable',
        },
      }
    );
  } catch (e: any) {
    console.error('Error generating image:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}