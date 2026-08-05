import { createApp } from "vue"
import { createPinia } from "pinia"
import "./style.css"
import App from "./App.vue"
import router from "./router"
import vuetify from "./plugins/vuetify"

const app = createApp(App)

// router のガードから useAuthStore() を呼ぶため、router より先に Pinia を登録する
app.use(createPinia())
app.use(vuetify)
app.use(router)

app.mount("#app")
