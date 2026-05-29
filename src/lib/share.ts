export function shareToWhatsApp(title: string, content: string) {
  let cleanContent = content || "";
  cleanContent = cleanContent.replace(/^#{1,6}\s+(.*)$/gm, '*$1*');
  cleanContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '*$1*');
  cleanContent = cleanContent.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleanContent = cleanContent.replace(/^\s*\*\s+/gm, '- ');
  cleanContent = cleanContent.trim().replace(/\n{3,}/g, '\n\n');

  const text = encodeURIComponent(
    `*${title}*\n\n${cleanContent}\n\n───────────────\nhttps://grace-daily.app`
  );
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

export function printPdf(title: string, content: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup diblokir oleh browser. Izinkan popup untuk mencetak PDF.");
    return;
  }
  
  let htmlContent = content
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 2cm; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.8; 
            color: #1f2933; 
            padding: 2rem; 
            max-width: 800px; 
            margin: 0 auto; 
          }
          h1 { color: #14213d; margin-bottom: 2rem; border-bottom: 2px solid #dfd8ca; padding-bottom: 1rem; }
          .content { font-size: 14px; }
          .footer { margin-top: 4rem; font-size: 12px; color: #52606d; text-align: center; border-top: 1px solid #dfd8ca; padding-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="content">${htmlContent}</div>
        <div class="footer">Grace Daily - https://grace-daily.app</div>
        <script>
          setTimeout(() => {
            window.print();
            setTimeout(() => window.close(), 500);
          }, 500);
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
