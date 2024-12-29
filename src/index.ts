import { VK, type WallPostContext } from 'vk-io'
import 'dotenv/config'

import type { Mailing } from './types/vk'

function spawnBot({
	botToken,
	senderToken,
	botName,
}: { botToken: string; senderToken: string; botName: string }): VK {
	const getPrefix = () => {
		const [date, time] = new Date().toISOString().split('.')[0].split('T')
		return `[${botName} | ${date.split('-').toReversed().join('.')} ${time}]`
	}
	const logger = {
		// biome-ignore lint/suspicious/noExplicitAny:
		log: (...args: any[]) => console.log(getPrefix(), ...args),
		// biome-ignore lint/suspicious/noExplicitAny:
		warn: (...args: any[]) => console.warn(getPrefix(), ...args),
		// biome-ignore lint/suspicious/noExplicitAny:
		error: (...args: any[]) => console.error(getPrefix(), ...args),
		// biome-ignore lint/suspicious/noExplicitAny:
		debug: (...args: any[]) => console.debug(getPrefix(), ...args),
	}

	if (!botToken) {
		throw new Error('VK_BOT_TOKEN is not defined')
	}
	if (!senderToken) {
		throw new Error('VK_SENDER_TOKEN is not defined')
	}

	const vk = new VK({
		token: botToken,
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
			logger.error(`[${botName}] status: ${res.status}`)
			logger.error(await res.json())
			return
		}

		logger.log(`Successfully sent mailing ${mailingId}`)
	}

	vk.updates.on('wall_post_new', async ({ wall }: WallPostContext) => {
		const { text, ownerId } = wall

		if (!text) {
			return
		}

		const mailings = await getMailings()

		for (const mailing of mailings) {
			if (!text.includes(mailing.name)) {
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
		logger.log('Бот запущен')
	})

	return vk
}

for (let i = 1; i < +process.env.TOKENS_AMOUNT + 1; i++) {
	const botToken = process.env[`VK_BOT_TOKEN_${i}`]
	const senderToken = process.env[`VK_SENDER_TOKEN_${i}`]
	const botName = process.env[`VK_BOT_NAME_${i}`] || 'default'

	if (!botToken || !senderToken) {
		console.error(
			`VK_BOT_TOKEN_${i} or VK_SENDER_TOKEN_${i} is not defined for i = ${i}`,
		)
		continue
	}

	if (botName === 'default') {
		console.warn(`Name isn't set for bot with i = ${i}`)
	}

	spawnBot({
		botToken,
		senderToken,
		botName,
	})
}
