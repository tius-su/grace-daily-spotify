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


    const bgParam = searchParams.get('bg') || 'cream';
    
    // Define 6 beautiful background and text color themes + landing page colors
    const colorThemes: Record<string, { bg: string; title: string; desc: string }> = {
      cream: { bg: '#FAF7F2', title: '#43382D', desc: '#786858' },
      sage: { bg: '#E6ECE6', title: '#2D3A2D', desc: '#5A6C5A' },
      blue: { bg: '#E6ECF2', title: '#233343', desc: '#4F6378' },
      rose: { bg: '#ECE6EC', title: '#3E2D3E', desc: '#725772' },
      amber: { bg: '#F8F3E9', title: '#4C3C2C', desc: '#8C745C' },
      gray: { bg: '#F1F3F5', title: '#2F353C', desc: '#5E6770' },
      // Landing page specific colors
      green: { bg: '#e9f5db', title: '#14213d', desc: '#284b3a' },
      teal: { bg: '#2a6f6f', title: '#ffffff', desc: '#e9f5db' },
      beige: { bg: '#f7f4ee', title: '#14213d', desc: '#52606d' },
      warmwhite: { bg: '#fffdf8', title: '#14213d', desc: '#334155' },
      dark: { bg: '#14213d', title: '#fffdf8', desc: '#dfd8ca' },
    };
    
    const theme = colorThemes[bgParam] || colorThemes.cream;
    
    // Resolve logo image absolute path for Vercel Edge OG Image Response
    const origin = request.nextUrl.origin;
    const logoUrl = `${origin}/logo.png`;
    
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
 
    const padding = isVertical ? '120px' : '50px';
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
            padding: padding,
            fontFamily: 'sans-serif',
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
              maxWidth: '90%',
              flexShrink: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: descFontSize,
              color: theme.desc,
              textAlign: 'center',
              maxWidth: '90%',
              lineHeight: 1.35,
              flexShrink: 0,
            }}
          >
            {description}
          </p>
        </div>
      ),
      {
        width: width,
        height: height,
        headers: {
          'Content-Disposition': 'inline; filename="devotion-banner.png"',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      }
    );
  } catch (e: any) {
    console.error('Error generating image:', e);
    return new Response('Failed to generate image', { status: 500 });
  }
}