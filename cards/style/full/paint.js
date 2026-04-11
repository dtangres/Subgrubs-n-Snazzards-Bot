const Canvas = require('@napi-rs/canvas');
const path = require('node:path');

const global_settings = {
	card_width: 900,
	card_height: 1200,
	card_corner_roundness: 80,
	text_color: '#cccccc',
	info_fill_color: '#101113',
	info_border_thickness: 10,
	info_box_width: 750,
	info_box_height: 100,
	info_box_altitude: 1050,
	drop_shadow_color: '#000000',
	drop_shadow_blur: 25,
	info_corner_roundness: 5,
	text_font_size: 48,
	text_modifiers: 'bold',
	text_font: 'Courier New',
	info_padding: 30,
};
async function paintCard(data, set, name) {
	const { card_info } = data;
	const { card_width, card_height, card_corner_roundness, text_color, info_fill_color, info_border_thickness, info_box_width, info_box_height, info_box_altitude, drop_shadow_color, drop_shadow_blur, info_corner_roundness, text_font_size, text_modifiers, text_font, info_padding } = global_settings;
	const { art_path, info_border_color, box_text } = card_info.cards[name];
	// Adjust text_font_size dnyamically
	const char_width = text_font_size / 2 * 3;
	const max_chars = (info_box_width - (info_padding * 2) - info_border_thickness) / char_width
	const adj_text_font_size = text_font_size - Math.max(0, box_text.length - max_chars) / 2;
	const text_format = `${text_modifiers} ${adj_text_font_size}px ${text_font}`;

	const art_dir = path.join(__dirname, '../../', `${set}/art/`);

	// Card art
	const canvas = Canvas.createCanvas(card_width, card_height);
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	// Draw card background
	context.beginPath();
	context.roundRect(0, 0, canvas.width, canvas.height, [card_corner_roundness]);
	context.fill();
	context.closePath();

	// Add card art
	context.globalCompositeOperation = 'source-in';
	console.log(path.join(art_dir, '/', art_path));
	const card_art = await Canvas.loadImage(path.join(art_dir, '/', art_path));
	context.drawImage(card_art, 0, 0, card_width, card_height);

	// Info box layer
	const canvas_info = Canvas.createCanvas(card_width, card_height);
	const ctx_info = canvas_info.getContext('2d');
	ctx_info.imageSmoothingEnabled = false;
	ctx_info.textAlign = 'center';
	ctx_info.textBaseline = 'middle';

	// Info box
	ctx_info.globalCompositeOperation = 'source-over';
	ctx_info.beginPath();
	ctx_info.strokeStyle = info_border_color;
	ctx_info.lineWidth = info_border_thickness;
	ctx_info.fillStyle = info_fill_color;
	ctx_info.save();
	ctx_info.roundRect((card_width - info_box_width) / 2, info_box_altitude - (info_box_height / 2), info_box_width, info_box_height, [info_corner_roundness, info_corner_roundness, info_corner_roundness, info_corner_roundness]);
	ctx_info.fillRect((card_width - info_box_width) / 2, info_box_altitude - (info_box_height / 2), info_box_width, info_box_height);
	ctx_info.shadowColor = drop_shadow_color;
	ctx_info.shadowBlur = drop_shadow_blur;
	ctx_info.stroke();
	ctx_info.restore();
	ctx_info.fill();
	ctx_info.closePath();

	// Add nametext drop shadow
	ctx_info.globalCompositeOperation = 'source-over';
	ctx_info.save();
	ctx_info.beginPath();
	ctx_info.fillStyle = drop_shadow_color;
	ctx_info.shadowColor = drop_shadow_color;
	ctx_info.shadowBlur = drop_shadow_blur;
	ctx_info.font = text_format;
	ctx_info.fillText(box_text, card_width / 2, info_box_altitude, info_box_width - (info_padding * 2));
	ctx_info.closePath();
	ctx_info.restore();

	// Add nametext
	ctx_info.save();
	ctx_info.beginPath();
	ctx_info.fillStyle = text_color;
	ctx_info.font = text_format;
	ctx_info.fillText(box_text, card_width / 2, info_box_altitude, info_box_width - (info_padding * 2));
	ctx_info.closePath();
	ctx_info.restore();

	// Layer collapse
	context.globalCompositeOperation = 'source-atop';
	context.drawImage(canvas_info, 0, 0);

	return await canvas.encode('png');
}

module.exports = {
	paintCard: paintCard,
};