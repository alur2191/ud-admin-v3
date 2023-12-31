"use client";
import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRootContext } from '../../context/RootContext'
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Image as tiptapImage } from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor } from '@tiptap/react';
import TipTapEdit from '@/components/blog/tiptapEditor/tiptap-edit';
import styles from './create.module.scss';
import Nav from '@/components/dashboard/nav';
import { Input } from '@/components/input';
import { redirect } from "next/navigation";

function CreatePost() {
	const [firstParagraph, setFirstParagraph] = useState<string>();
	const [fileSizeWarning, setFileSizeWarning] = useState('');

	let file: File | null = null;
	const supabase = createClientComponentClient()

	const { blogTitle, setBlogTitle } = useRootContext();
	useEffect(() => {
		setBlogTitle('');
	}, []);

	function handleFiles(
		e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
	) {
		const files = (e.target as HTMLInputElement).files;
		file = files![0];
		// Check file size and set warning if it's too large
		if (file.size > 1572864) {
			setFileSizeWarning('File size exceeds 1.5MB. Please choose a smaller file.');
			file = null;
		} else {
			setFileSizeWarning('');
		}
	}

	const tipTapEditor = useEditor({
		extensions: [
			StarterKit,
			Highlight,
			Typography,
			tiptapImage,
			TextAlign.configure({
				types: ['heading', 'paragraph'],
			}),
		],
		onUpdate({ editor }) {
			if (!editor.getJSON().content![0].content) return;
			const paragraph = editor.getJSON().content![0].content![0].text;
			if (paragraph) {
				setFirstParagraph(
					paragraph.length < 120
						? paragraph.substring(0, 120)
						: `${paragraph.substring(0, 120)}...`,
				);
			}
		},
	});


	async function handleImageUpload() {
		const datePrefix = Date.now();
		const fileName = `media/${datePrefix}-${file!.name}`;
		// Get signed key for file name in current directory.
		const response = await fetch(
			`/api/presignedurl?fileName=${fileName}`
		);

		const data = await response.json();
		const url = data.signedUrlObject.url;
		fetch(url, {
			method: "PUT",
			body: file,
		})
			.then((response) => {
				if (!response.ok) {
					return `Error uploading ${fileName}.`;
				}
			})
			.catch((err) => {
				return `Error uploading ${fileName}.`
			});
		return `${process.env.NEXT_PUBLIC_S3_URL}${fileName}`
	}

	const postBlog = async () => {
		let image = '';

		if(file){
			image = await handleImageUpload();
		}

		const {
			data: { user },
		} = await supabase.auth.getUser();

		const { data, error } = await  supabase.from('posts').insert({ 
			entry: tipTapEditor?.getJSON(),
			author: user?.id,
			title: blogTitle,
			first_paragraph: firstParagraph,
			image
		})
		if (!error) {
			redirect('/blog');
		}
	};

	const eraseBlog = () => {
		tipTapEditor?.commands.clearContent();
	};

	const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setBlogTitle(e.target.value);
	};


	return (
		<div className={styles.container}>
			<div>
				<Nav />
			</div>
			<form className={styles.main} action={postBlog}>
				<div className={styles.topContainer}>
					<div>
						<Input labelFor="title" labelText="Title" required>
							<input
								id="title"
								type="text"
								className={styles.titleInput}
								onChange={onTitleChange}
								value={blogTitle || ''}
								required
							/>
						</Input>
						<Input labelFor="featured-image" labelText="Featured Image">
							<input
								onChange={handleFiles}
								id="featured-image"
								type="file"
								accept="image/*"
							/>
						</Input>
						{fileSizeWarning && <p style={{ color: 'red' }}>{fileSizeWarning}</p>}
					</div>
				</div>
				<TipTapEdit editor={tipTapEditor} />
				<div className={styles.buttons}>
					<button type='submit'>Publish</button>
					<button className={styles.clearButton} onClick={eraseBlog}>Clear</button>
				</div>
			</form>
		</div>
	);
}

export default CreatePost;
