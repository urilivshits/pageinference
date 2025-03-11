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

## 2025-03-10 17:24:00
"1. make it so if user started adding text to input the input should not be cleared until page is reloaded (follow simillar approach to chat history)
2. chose a better icon for "copy" for dark mode
3. save past chats in session/user storage and allow going back to them"

## 2025-03-10 17:37:21
"1. add new conversation button
2. make sure after page reload new conversation is used by default"

## 2025-03-10 17:47:19
"1. remove "new conversation" button, only keep new conversartion icon
2. make sure when choosing a past conversation its mesage history is shown
3. indicate clearly in what conversation user is at any point of time
4. move dark mode choice to settings
5. rename project to "Talk to any webpage"
6. give more width to the extension popup"

## 2025-03-10 18:00:23
"1. remove clear chat button and functionality
2. allow instead to delete a conversation with its content from the conversation list
3. make sure after inference is made the use input is cleared."

## 2025-03-10 19:37:08
"simplify the current/past conversation ui/ux:
1. if past conversation is chosen show only past conversation list, dont show both the past conversation list and the chat input functionality at the same time.
2. remove the "Started a new conversation" and "Switched to previous conversation" messages and related elements - it will save us more space
3. remove this "Ask a question about the current page." as well
4. indicate whether user is in new conversation or in past conversation by highlighting the header icons only"

## 2025-03-10 20:15:32
"1. remove "save settings" and "back" buttons, save on change instead
2. fix issue with history: whenever i close the page and reopen again and go to history i see the title of conversation in history and number of messageses but the messages list does not load"

## 2025-03-10 20:25:45
"1. now on a new page/tab it starts with "past conversations" tab
2. back button is still there on settings page"

## 2025-03-10 21:08:41
"great, it helped. Now lets also handle the following:
1. remove the dark mode icon from settings (the toggle in settings is enough)
2. after page load and after inference the view changes to "past conversations", instead on both page load and on inference it needs to stay in the "new conversation"
3. check the @rules.mdc and make sure you follow them"

## 2025-03-10 21:15:59
"cool, lets hide the close button in settings too: states will be changing by clicking on the 3 header tabs in the top"

## 2025-03-10 23:14:55
"there seems to be an issue with how past conversations are stored. Or on what happens when "new conversation" is clicked. basically at some point i cannot access the past conversations' messages anymore - at some point whenever i click on a past conversation thread to continue a previous chat it just sends me to "new conversation" which is empty"

## 2025-03-10 23:52:04
"ok, so now the issue that remained is:
1. if i make a conversation on this page: @https://www.linkedin.com/in/yuriy-leonov/  then i can access the history whenever im on that page correctly
2. if i then switch to this page @https://www.linkedin.com/in/iuliiashyshka/ i still see my conversation from the previous page but i cannot access the messages
3. the correct way would be:
- having access to past conversations from the same baseUrl"

## 2025-03-11 10:11:29
"it looks like now history is not working at all, i see the history title and number of messages but when i click on it nothing happens"

## 2025-03-11 11:28:46
"1. @rules.mdc  make sure to follow the project rules
2. make it so if a new active topic is created it gets added to history right away"

## 2025-03-11 11:53:37
"lets also make sure there's not more than 1 exmpty new conversation at a time on the same website. this means whenever new topic starts > check if there is an empty topic previously from the same website > remove the old one and write the new one to the history list"

## 2024-03-11 12:30:00
"it works, but please try to update all the necessary files again as specified in the @rules.mdc"

## 2025-03-11 12:30:00
"now also please make sure that the on each history item list the last user request data is shown (now it shows no request even though there was a new request that went well). no need to handle older chats"

## 2025-03-11 12:39:50
"lets continue:
1. after first message is sent upon sending the second message for inference it says no active tab found even though im still on it"

## 2025-03-11 13:14:54
"follow the rules and address the following:
1. make sure the project follows consistent design philosophy
2. as far as i can tell some elements have border radius and some dont (such as popups external border)
3. lets follow design philosophy of google chrome as close as possible"

## 2025-03-11 13:27:01
"lets make sure that if a conversation from history is continued then it moves to the beginning of the history list (which it does) but also that if in history list there are empty conversations then they get removed"

## 2025-03-11 14:00:30
"after the latest update empty conversation is not getting added to the history list as it did before'"

## 2025-03-11 14:12:50
"great, please also check the @rules.mdc and make it so that the copy icon does not occupy a separate line just for itself"

## 2025-03-11 14:16:20
"great, but make sure it applies to assistant messages as well"

## 2025-03-11 14:18:17
"also please make sure that copy icon is in bottom right"

## 2025-03-11 14:20:10
"now the copy icon is invisible"

## 2025-03-11 14:22:20
"1. it is not correctly centered in the bottom right (on pic) 
2. also it needs to have transparent bg"

## 2025-03-11 14:47:03
"fol@rules.mdc and make sure:
1. outer scroll bar (scroll bar of popup) is hidden at all times
2. in conversations (in chat and in history) all the elements are visible without the need for outer scroll, namely:
- the header section (chat, history, settings)
- the conversation itself with the inner scroll bar (of the conversation) 
- user input box and "ask" button"

## 2025-03-11 14:50:15
"now only 1 line of the popup is visible and thats it"