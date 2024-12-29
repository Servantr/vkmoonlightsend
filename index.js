const { VK, Keyboard, users, executes } = require('vk-io')
const { vk_token, sender_token } = require('./config.json')
var XMLHttpRequest = require('xhr2')
const Sequelize = require('sequelize')
const { Collection } = require('discord.js')

const useradmins = new Collection();
const alltitles = new Collection();

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'db.sqlite',
})

const admins = sequelize.define(
    'usersadmins',
    {
        user_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            defaultValue: 0
        },
        isAdmin: {
            type: Sequelize.INTEGER,
            defaultValue: 0
        }
    }, {
    timestamps: false,
}
)

const titles = sequelize.define(
    'titles',
    {
        title_name: {
            type: Sequelize.STRING
        },
        title_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            defaultValue: 0
        }
    }, {
    timestamps: false,
}
)

const vk = new VK({
    token: vk_token,
})

async function onStart() {

    const storedTitles_id = await titles.findAll()
    storedTitles_id.forEach((b) => alltitles.set(b.title_id, b))

    const storedTitles = await titles.findAll()
    storedTitles.forEach((b) => alltitles.set(b.title_name, b))

    const storedAdmins = await admins.findAll()
    storedAdmins.forEach((b) => useradmins.set(b.user_id, b))

}

function getTitle(title_name) {
    const title = alltitles.get(title_name)
    return title ? title.title_id : 0;
}

async function addTitle(title_id, title_name) {
    const title = alltitles.get(title_id)

    if (title) {
        title.title_name = title_name
        return title.save()
    }

    const newTitle = await titles.create({ title_id: title_id, title_name: title_name })
    alltitles.set(title_id, newTitle)

    return newTitle
}

function getAdmins(user_id) {
    const user = useradmins.get(user_id)
    return user ? Boolean(user.isAdmin) : false;
}

async function addAdmin(user_id, isAdmin) {
    const user = useradmins.get(user_id)

    if (user) {
        user.isAdmin = Boolean(isAdmin)
        return user.save()
    }

    const newUser = await admins.create({ user_id: user_id, isAdmin: Boolean(isAdmin) })
    useradmins.set(user_id, newUser)

    return newUser
}

vk.updates.on('message_new', async (context) => {

    let tdate = Date.now()
    tdate = (tdate - (tdate % 1000)) / 1000

    console.log("current date " + String(tdate+1)) 
    console.log("sended date " + String(context ? context.createdAt : 0))
    console.log(tdate+1 == context ? context.createdAt : 0)

    if (context.text === "tei!updatetable" && getAdmins(context.senderId) && context.createdAt == tdate + 1 || context.createdAt == tdate ) {

        let response = await fetch(`https://broadcast.vkforms.ru/api/v2/list/?token=${sender_token}`)
        if (response.ok) {

            let result = await response.text();

            resultparse = JSON.parse(result)

            resultarray = resultparse.response.lists

            resultarray.forEach((e) => addTitle(e.id, e.name))

            context.send(
                `Таблицы рассылок обновлены.`
            )
        }

    }
    else if (context.text.includes("tei!addadmin") && getAdmins(context.senderId) && context.createdAt == tdate + 1) {
        let addtext = context.text

        //console.log(context)

        text = addtext.split(' ')

        try {
            console.log(text[1])
            var numberPattern = /\d+/g

            let user_id = text[1].match(numberPattern)[0]

            addAdmin(Number(user_id), text[2])
        } catch {
            await context.send(
                `Произошла ошибка, проверьте правильность написания команды: !addadmin [@пользователь] [1/0]`
            )
        }

    }
})

function findSendTitle(title_name, context) {
    var title = undefined

    if (context.wall.text.toLowerCase().includes(title_name.toLowerCase())) {
        title = title_name
    } else {
        return
    }

    console.log(title);
    console.log(`wall-${-context.wall.ownerId}_${context.wall.id}`);

    title = getTitle(title)
    if (title !== undefined) {

        var xhr = new XMLHttpRequest()
        xhr.open(
            'POST',
            `https://broadcast.vkforms.ru/api/v2/broadcast?token=${sender_token}`,
            true
        )
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.send(
            JSON.stringify({
                message: {
                    attachment: `wall-${-context.wall.ownerId}_${context.wall.id}`,
                },
                list_ids: [title],
                run_now: 1
            })
        )

    }

}

vk.updates.on('wall_post_new', async (context) => {
    //Получение всех рассылок

    let tdate = Date.now()
    tdate = (tdate - (tdate % 1000)) / 1000 

    console.log("current date " + String(tdate+1)) 
    console.log("sended date " + String(context.wall.createdAt))
    console.log(tdate+1 == context.wall.createdAt)
    if (context.wall.createdAt == tdate+1 || context.wall.createdAt == tdate) {

        let response = await fetch(`https://broadcast.vkforms.ru/api/v2/list/?token=${sender_token}`)

        if (response.ok) {
            let result = await response.text();

            resultparse = JSON.parse(result)

            resultarray = resultparse.response.lists

            //Проход по массиву полученных имен, есть ли там нужное название?
            resultarray.forEach((e) => {
                let shouldSkip = findSendTitle(e.name, context)
                if (shouldSkip) { return }
            })

        }


    }
})

vk.updates.start().then(console.log('Бот запущен')).then(onStart())