// src/app/page.tsx

'use client';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';

// A simple component for the choice cards
const ChoiceCard = ({ title, description, imageUrl, linkUrl }: { title: string, description: string, imageUrl: string, linkUrl: string }) => {
    return (
        <Link href={linkUrl} className="group w-1/2 block rounded-lg overflow-hidden shadow-xl transform transition-transform duration-300 hover:scale-105 border border-gray-200">
            <div className="relative h-96">
                <Image
                    src={imageUrl}
                    alt={title}
                    layout="fill"
                    objectFit="cover"
                    className="transition-opacity duration-300 group-hover:opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 p-8">
                    <h3 className="text-3xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-200 text-lg">{description}</p>
                </div>
            </div>
        </Link>
    );
};

// Simple Footer component
const PageFooter = () => {
    return (
        <footer className="w-full bg-gray-100 border-t mt-24">
            <div className="container mx-auto py-8 px-4 text-center text-gray-600">
                <h3 className="text-lg font-semibold mb-4">Acknowledgements</h3>
                <p className="text-sm max-w-2xl mx-auto mb-4">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed doeiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                {/* You can add logos here later if you want */}
            </div>
        </footer>
    );
};


export default function HomePage() {
    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow">
                {/* Hero Section */}
                <div className="relative h-[60vh] flex items-center justify-center text-center bg-gray-800 text-white overflow-hidden">
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30"
                        style={{ backgroundImage: "url('/microtubule-bg.jpg')" }} // <-- Add a background image here
                    ></div>
                    <div className="relative z-10 px-4">
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 drop-shadow-lg">tubulin.xyz</h1>
                        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto mb-8 drop-shadow-md">
                            An interactive interface for the atomic structure of the tubulin dimer and the microtubule lattice.
                        </p>
                        <form className="max-w-xl mx-auto" onSubmit={(e) => e.preventDefault()}>
                            <div className="relative">
                                <input
                                    type="search"
                                    placeholder="Search for structures, proteins, or ligands..."
                                    className="w-full p-4 pl-12 text-lg text-gray-900 bg-white rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                                <div className="absolute top-0 left-0 h-full flex items-center pl-4">
                                    <Search className="h-6 w-6 text-gray-400" />
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="container mx-auto px-4 -mt-24 relative z-20">
                    <div className="flex flex-col md:flex-row gap-8">
                        <ChoiceCard
                            title="Curved Structures"
                            description="Explore tubulin in its soluble, unpolymerized state."
                            imageUrl="/curved-tubulin.png" // <-- Add this image
                            linkUrl="/structures?conformation=curved" // Future link to catalog page
                        />
                        <ChoiceCard
                            title="Straight Structures"
                            description="Analyze tubulin conformation within microtubule lattices."
                            imageUrl="/straight-tubulin.png" // <-- Add this image
                            linkUrl="/structures?conformation=straight" // Future link to catalog page
                        />
                    </div>
                </div>
            </main>

            <PageFooter />
        </div>
    );
}