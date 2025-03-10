# User Queries
<!-- User queries to be updated on every query. -->

<!-- 
Example query format for future reference:
## YYYY-MM-DD HH:MM:SS
"This is an example of a user query. It shows how queries should be formatted in this document, with a timestamp header and the query text in quotes."
-->

## 2025-03-10 13:18:39
"check @rules.mdc  and @Chrome Extensions and create a chrome extension that will:
1. scrape the page user is on (locally or else, as long as it can retrieve the data)
2. and answer a question based on the page's data with openapi inference
3. follow best practices"

## 2025-03-10 13:28:39
"why did you add MIT license? can I not monetize this software?"

## 2025-03-10 14:25:48
"seems like you forgot to create icons in /icons. please check what else could be forgotten."

## 2025-03-10 15:45:18
"great, it works. now lets make it so that the default model is o3-mini and so that the chat history is saved from message to message as long as user is still on the same page."

## 2025-03-10 14:35:22
"OpenAI API Error: Error: The model `o3-mini` does not exist or you do not have access to it.
    at getOpenAiInference (background.js:136:13)
    at async background.js:86:24

how come i dont have access to it? its a paid api token. maybe o3-mini is region-locked?"

## 2025-03-10 14:38:15
"are you sure? @https://openai.com/api/pricing/ "

## 2025-03-10 16:06:32
"lets change the default model to gpt-4o-mini"

## 2025-03-10 16:42:53
"cool, and now please:
1. make it so i can submit the message by pressing "enter"
2. chat history should not be getting cleared when i alt+tab or go to a different browser tab and back to the tab with chat. Chat should only clear if "clear" button is pressed or if page is reloaded. 
3. UI should follow system's dark mode settings and also allow to swith it on/off"

## 2025-03-10 16:58:59
"1. rename the extension to "Talk to the webpage"
2. on dark mode ensure input color is fine (now its black on dark mode)
3. add button to copy each response and each user query
4. make scroll bar smaller and better for both light and dark modes"

## 2025-03-10 17:10:25
"lets update the inferense params:
1. if model can use search tool - it should be able to use it
2. based on scraped content the type of webpage should be estimated so that model could better fit to the user needs, e.g.: if im using it on linkedin im probably interested in job search topics - im either looking for job or for candidates. Feel free to expand on this logic."