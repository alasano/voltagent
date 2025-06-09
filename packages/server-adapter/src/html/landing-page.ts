/**
 * Generate the comprehensive VoltAgent landing page HTML
 * Based on the original API landing page with full styling and features
 */
export function generateLandingPageHtml(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Voltagent Core API</title>
        <style>
            body {
                background-color: #2a2a2a; /* Slightly lighter dark */
                color: #cccccc; /* Light gray text */
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                text-align: center;
            }
            .container {
                padding: 40px;
            }
            h1 {
                color: #eeeeee; /* Brighter heading */
                border-bottom: 1px solid #555555; /* Subtler border */
                padding-bottom: 10px;
                margin-bottom: 20px;
                font-weight: 500; /* Slightly lighter font weight */
            }
            p {
                font-size: 1.1em;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            a {
                color: #64b5f6; /* Light blue link */
                text-decoration: none;
                font-weight: bold;
                border: 1px solid #64b5f6;
                padding: 10px 15px;
                border-radius: 4px;
                transition: background-color 0.2s, color 0.2s;
             }
            a:hover {
                text-decoration: underline; /* Add underline on hover */
            }
            .logo {
              font-size: 1.8em; /* Slightly smaller logo */
              font-weight: bold;
              margin-bottom: 30px;
              color: #eeeeee;
            }
            .support-links {
                margin-top: 15px;
            }
            .support-links p {
                margin-bottom: 15px;
            }
            .support-links a {
                border: none;
                padding: 0;
                font-weight: bold;
                color: #64b5f6;
            }
            .api-links {
                margin-top: 30px;
                display: flex;
                flex-direction: row;
                justify-content: center;
                align-items: center;
                gap: 25px;
            }
            .api-links a {
                border: none;
                padding: 0;
                font-weight: bold;
                color: #64b5f6;
            }
            .separator {
                color: #555555;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">VoltAgent</div>
            <h1>API Running ⚡</h1>
            <p>Manage and monitor your agents via the VoltOps Platform.</p>
            <a href="https://console.voltagent.dev" target="_blank" style="margin-bottom: 30px; display: inline-block;">Go to VoltOps Platform</a>
            <div class="support-links">
              <p>If you find VoltAgent useful, please consider giving us a <a href="http://github.com/voltAgent/voltagent" target="_blank"> star on GitHub ⭐</a>!</p>
              <p>Need support or want to connect with the community? Join our <a href="https://s.voltagent.dev/discord" target="_blank">Discord server</a>.</p>
            </div>
            <div class="api-links">
              <a href="/ui" target="_blank">Swagger UI</a>
              <span class="separator">|</span>
              <a href="/doc" target="_blank">OpenAPI Spec</a>
            </div>
        </div>
        <script>
            console.log("%c⚡ VoltAgent Activated ⚡ %c", "color: #64b5f6; font-size: 1.5em; font-weight: bold;", "color: #cccccc; font-size: 1em;");
        </script>
    </body>
    </html>
  `;
}
