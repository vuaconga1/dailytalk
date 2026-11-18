/** Zalo domain ownership verifier (HTML file method). */
export const dynamic = "force-static";

const HTML = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta property="zalo-platform-site-verification" content="HEVcTRRoCMfX-hf-e-SIVYBXX7_EbrycEJat" />
</head>

<body>
There Is No Limit To What You Can Accomplish Using Zalo!
</body>

</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
