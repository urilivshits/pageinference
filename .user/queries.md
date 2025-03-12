# User Queries
<!-- User queries to be updated on every query. -->

<!-- 
DO NOT DELETE THIS EXAMPLE - It serves as a format guide

Format for recording queries:
"This is an example of a user query. It shows how queries should be formatted in this document with the query text in quotes."
-->

"reindex the repo and update artifacts. follow @rules.mdc"

"lets also review the @README.md and see that its in sync with the current state of the project"

"now lets update the @README.md with the latest as well please"

"chrome extension throws Uncaught ReferenceError: themeOptions is not defined on popup.js:670 (anonymous function)."

"ok, but ensure you follow the @rules.mdc thoroughly"

"1. follow the @rules.mdc 
2. resolve the issue with the load spinner not spinning correctly - it does not do circle now as if it does not fit in its container"

"better, but lets also center it in its container"

"seems like the spinner is still not centered in the "Ask" button - it is now spinning in bottom right of the button"

"handle good output formatting and styling of llm response. follow industry-standards."

"on response it throws "window.markdownit is not a function""

"no error but i dont see any change. i currently get llm responses rendered like a so:

Based on the information provided about Yura Leonov's profile and the requirements for the Camera HW Design Engineer position at Apple, here's an evaluation of how his experience matches the job: ### Relevant Experience 1. **Technical Background**: - Yura has extensive experience in software development, particularly as a Full Stack Developer and Development Team Lead. However, the job in question focuses on hardware design, specifically in camera hardware engineering, which requires a strong background in electrical engineering and hardware design. - The position requires expertise in electronic design, including schematic creation and knowledge of analog and digital circuits. Yura's experience does not indicate a background in hardware design or electrical engineering, which is critical for this role. 2. **Project Management**: - Yura has experience managing teams and projects, particularly as a Development Team Lead and Co-Founder of GamersPoint. This experience could be beneficial in managing different projects in parallel, as required by the job. 3. **Interpersonal Skills**: - His profile mentions strong collaboration and communication skills, which are essential for interacting with product teams and ensuring good implementation for system integration. ### Missing Qualifications 1. **Educational Background**: - The job requires a BS/MS in Electrical Engineering or equivalent industrial experience. Yura holds an MBA and a Master's in Diplomacy & Conflict Studies, which does not align with the technical requirements of the position. 2. **Specific Hardware Skills**: - The role demands hands-on experience with electronic test equipment and knowledge of layout strategies, EMI minimization, and RF experience. Yura's profile does not indicate any experience in these areas, which are crucial for the Camera HW Design Engineer role. 3. **Experience with Camera Technology**: - The job description mentions a preference for knowledge of CMOS image sensors and image processing. Yura's background does not suggest any experience in camera hardware or related technologies. ### Conclusion Overall, Yura Leonov's experience does not align well with the Camera HW Design Engineer position at Apple. While he has strong software development and project management skills, he lacks the necessary hardware design experience, educational background in electrical engineering, and specific knowledge related to camera technology. **Rating**: **2/10** - Limited relevance to the position, primarily due to the lack of hardware engineering experience and educational qualifications in the required field.

i need them to properly render titles, subtitles, codeblocks, etc."

now i get the response where some elements are bold but others are still with ###. Lets improve the fallback for sure, but lets also understand why the lib is not working correctly. 

here are the errors from extensions:
Refused to load the script 'https://cdnjs.cloudflare.com/ajax/libs/markdown-it/13.0.1/markdown-it.min.js' because it violates the following Content Security Policy directive: "script-src 'self'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
Refused to load the script 'https://cdnjs.cloudflare.com/ajax/libs/markdown-it/13.0.1/markdown-it.min.js' because it violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
markdown-it is not available, falling back to plain text
markdown-it is not available, falling back to plain text
Refused to load the script 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js' because it violates the following Content Security Policy directive: "script-src 'self'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
Refused to load the script 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js' because it violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
Refused to load the script 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js' because it violates the following Content Security Policy directive: "script-src 'self'". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
Refused to load the script 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js' because it violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback.
Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'". Either the 'unsafe-inline' keyword, a hash ('sha256-Xb4NT+IN996RN+hwEWbrSP52Z1W5kX07irUdYh6lNRQ='), or a nonce ('nonce-...') is required to enable inline execution.
Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' http://localhost:* http://127.0.0.1:*". Either the 'unsafe-inline' keyword, a hash ('sha256-Xb4NT+IN996RN+hwEWbrSP52Z1W5kX07irUdYh6lNRQ='), or a nonce ('nonce-...') is required to enable inline execution.
Cannot load chat history: missing tab ID, URL, or page load ID
markdown-it library not found, using fallback basic markdown parser
markdown-it library not found, using fallback basic markdown parser

"sometimes i get this error on inference:

Error during tab communication setup: TypeError: Cannot read properties of undefined (reading 'startsWith')
Context
background.js
Stack Trace
background.js:212 (anonymous function)"

"still error on line 212:

Error during tab communication setup: TypeError: Cannot read properties of undefined (reading 'startsWith')
Context
background.js
Stack Trace

dont forget to update the docs"

"try again but also follow the @rules.mdc"
