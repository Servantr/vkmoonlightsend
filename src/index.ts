import { VK, type WallPostContext } from 'vk-io'
import 'dotenv/config'

import type { Mailing } from './types/vk'

const botToken = process.env.VK_BOT_TOKEN
const senderToken = process.env.VK_SENDER_TOKEN

if (!botToken) {
	throw new Error('VK_BOT_TOKEN is not defined')
}
if (!senderToken) {
	throw new Error('VK_SENDER_TOKEN is not defined')
}

const vk = new VK({
	token: process.env.VK_BOT_TOKEN,
})

function endpoint(name: 'list' | 'broadcast') {
	return `https://broadcast.vkforms.ru/api/v2/${name}/?token=${senderToken}` as const
}

async function getMailings(): Promise<Mailing[]> {
	return await fetch(endpoint('list'))
		.then((res) => res.json())
		.then((res) => res.response.lists)
}

async function sendMailings({
	message,
	mailingId,
}: {
	message:
		| string
		| {
				attachment: string
		  }
	mailingId: number
}) {
	console.log(
		JSON.stringify({
			message,
			list_ids: [mailingId],
			run_now: 1,
		}),
	)
	const res = await fetch(endpoint('broadcast'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			message,
			list_ids: [mailingId],
			run_now: 1,
		}),
	})

	const { status } = res
	if (status !== 200) {
		console.error(`status: ${res.status}`)
		console.error(await res.json())
		return
	}

	console.log(`Successfully sent mailing ${mailingId}`)
}

vk.updates.on('wall_post_new', async ({ wall }: WallPostContext) => {
	const { text, ownerId } = wall

	if (!text) {
		return
	}

	const mailings = await getMailings()

	for (const mailing of mailings) {
		if (!text.toLowerCase().includes(mailing.name.toLowerCase())) {
			continue
		}

		await sendMailings({
			mailingId: mailing.id,
			message: {
				attachment: `wall-${-ownerId}_${wall.id}`,
			},
		})
	}
})

vk.updates.start().then(async () => {
	console.log('Бот запущен')
})
